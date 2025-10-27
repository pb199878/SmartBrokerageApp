import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import axios from 'axios';

@Injectable()
export class AttachmentsService {
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Download attachment from Mailgun URL and store in Supabase
   * @param attachmentUrl - URL provided by Mailgun webhook
   * @param messageId - Message ID to associate attachment with
   * @param listingId - Listing ID for organizing storage
   * @param threadId - Thread ID for organizing storage
   * @param filename - Original filename
   * @param contentType - MIME type
   * @param size - File size in bytes
   */
  async downloadAndStoreAttachment(
    attachmentUrl: string,
    messageId: string,
    listingId: string,
    threadId: string,
    filename: string,
    contentType: string,
    size: number,
  ): Promise<any> {
    try {
      console.log(`📎 Downloading attachment: ${filename}`);

      // Download attachment from Mailgun URL
      const response = await axios.get(attachmentUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
      });

      const buffer = Buffer.from(response.data);

      // Create S3 key with organized structure
      const s3Key = `attachments/${listingId}/${threadId}/${messageId}/${filename}`;

      // Upload to Supabase Storage
      await this.supabaseService.uploadFile(
        'attachments', // bucket name
        s3Key,
        buffer,
        contentType,
      );

      console.log(`✅ Uploaded attachment to: ${s3Key}`);

      // Create attachment record in database
      const attachment = await this.prisma.attachment.create({
        data: {
          messageId,
          filename,
          contentType,
          s3Key,
          size,
          virusScanStatus: 'CLEAN', // Stub for now, integrate virus scanning later
        },
      });

      return attachment;
    } catch (error) {
      console.error(`❌ Failed to download/store attachment ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Get attachment by ID
   */
  async getAttachment(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        message: true,
        documentAnalysis: true,
      },
    });

    if (!attachment) {
      throw new Error(`Attachment ${id} not found`);
    }

    return attachment;
  }

  /**
   * Generate signed download URL for attachment
   */
  async getDownloadUrl(id: string): Promise<string> {
    const attachment = await this.getAttachment(id);

    // Generate signed URL (valid for 1 hour)
    const signedUrl = await this.supabaseService.getSignedUrl(
      'attachments',
      attachment.s3Key,
      3600, // 1 hour
    );

    return signedUrl;
  }

  /**
   * Get all attachments for a message
   */
  async getAttachmentsByMessage(messageId: string) {
    return this.prisma.attachment.findMany({
      where: { messageId },
      include: {
        documentAnalysis: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Filter out irrelevant attachments (signatures, logos, disclaimers)
   * This should be called BEFORE downloading to save storage space
   * Returns attachments that are likely important documents
   */
  filterRelevantAttachments(attachments: any[]): any[] {
    return attachments.filter(att => {
      // Handle both Mailgun format (content-type) and standard format (contentType)
      const filename = att.filename || '';
      const size = att.size || 0;
      const contentType = att['content-type'] || att.contentType || '';
      const lowerFilename = filename.toLowerCase();

      // Filter out common signature images (< 50KB images)
      if (
        size < 50000 && // < 50KB
        (contentType.startsWith('image/png') || 
         contentType.startsWith('image/jpg') || 
         contentType.startsWith('image/jpeg'))
      ) {
        if (
          lowerFilename.includes('signature') ||
          lowerFilename.includes('logo') ||
          lowerFilename.includes('banner') ||
          lowerFilename.includes('icon')
        ) {
          console.log(`⏭️  Skipping signature/logo: ${filename}`);
          return false;
        }
      }

      // Filter out disclaimer files
      if (
        lowerFilename.includes('disclaimer') ||
        lowerFilename.includes('notice') ||
        lowerFilename.includes('footer') ||
        lowerFilename.includes('confidentiality')
      ) {
        console.log(`⏭️  Skipping disclaimer: ${filename}`);
        return false;
      }

      // Filter out very small files (likely not important documents)
      if (size < 10000 && !contentType.startsWith('application/pdf')) { // < 10KB non-PDF
        console.log(`⏭️  Skipping small file: ${filename}`);
        return false;
      }

      // Include this attachment
      return true;
    });
  }

  /**
   * Prioritize attachments by relevance
   * Returns sorted array with most important attachments first
   */
  prioritizeAttachments(attachments: any[]): any[] {
    return attachments.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      const filenameA = a.filename.toLowerCase();
      const filenameB = b.filename.toLowerCase();

      // High priority keywords
      const highPriorityKeywords = ['offer', 'aps', 'form', 'agreement', 'amendment', 'schedule'];
      const mediumPriorityKeywords = ['contract', 'document', 'signed'];

      highPriorityKeywords.forEach(keyword => {
        if (filenameA.includes(keyword)) scoreA += 10;
        if (filenameB.includes(keyword)) scoreB += 10;
      });

      mediumPriorityKeywords.forEach(keyword => {
        if (filenameA.includes(keyword)) scoreA += 5;
        if (filenameB.includes(keyword)) scoreB += 5;
      });

      // PDFs are generally more important than images
      if (a.contentType === 'application/pdf') scoreA += 8;
      if (b.contentType === 'application/pdf') scoreB += 8;

      // Larger files are usually more important (documents vs images)
      if (a.size > 100000) scoreA += 3; // > 100KB
      if (b.size > 100000) scoreB += 3;

      return scoreB - scoreA; // Descending order
    });
  }
}

