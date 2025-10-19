import { Injectable } from '@nestjs/common';
// import { Queue } from 'bullmq';
// import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailgunService } from '../../common/mailgun/mailgun.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { MessageCategory } from '@prisma/client';

@Injectable()
export class EmailService {
  constructor(
    // @InjectQueue('email-processing') private emailQueue: Queue, // TODO: Uncomment when BullMQ is set up
    private prisma: PrismaService,
    private mailgunService: MailgunService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Process inbound email from Mailgun webhook
   * This will be the main entry point for incoming emails
   */
  async processInboundEmail(payload: any) {
    console.log('📧 Processing inbound email...');
    console.log(payload);

    // 1. Verify webhook signature (only in production)
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      const { timestamp, token, signature } = payload;
      const isValid = this.mailgunService.verifyWebhookSignature(
        timestamp,
        token,
        signature,
      );

      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return { error: 'Invalid signature' };
      }
      console.log('✅ Webhook signature verified');
    } else {
      console.log('⚠️  Skipping webhook signature verification (not in production)');
    }

    // 2. Parse email
    const email = this.mailgunService.parseIncomingEmail(payload);
    console.log(`From: ${email.from}`);
    console.log(`To: ${email.to}`);
    console.log(`Subject: ${email.subject}`);

    // TODO: When BullMQ is set up, enqueue job instead of processing directly
    // await this.emailQueue.add('process-email', { email, payload });
    
    // For now, process directly (stubbed)
    await this.processEmailDirectly(email);

    return { success: true, message: 'Email received' };
  }

  /**
   * Process email directly (used when queue is not available)
   * TODO: Move to EmailProcessor when BullMQ is set up
   */
  private async processEmailDirectly(email: any) {
    // 1. Extract listing alias from email address
    // Example: l-abc123@inbox.yourapp.ca -> l-abc123
    const listingAlias = email.to.split('@')[0]; // e.g., "l-abc123"
    console.log(`📧 Listing alias: ${listingAlias}`);

    // 2. Look up the actual listing by emailAlias
    const listing = await this.prisma.listing.findUnique({
      where: { emailAlias: listingAlias },
    });

    if (!listing) {
      console.error(`❌ No listing found for alias: ${listingAlias}`);
      throw new Error(`Invalid listing alias: ${listingAlias}`);
    }

    console.log(`✅ Found listing: ${listing.id} (${listing.address})`);

    // 3. Find or create sender
    const sender = await this.prisma.sender.upsert({
      where: { email: email.from },
      update: {},
      create: {
        email: email.from,
        name: this.extractNameFromEmail(email.from),
        domain: this.extractDomain(email.from),
      },
    });

    const emailThreadId = this.extractEmailThreadId(email);
    const allMessageIds: string[] = [];
    
    if (email.references) {
      allMessageIds.push(...this.parseReferences(email.references));
    }
    if (email.inReplyTo) {
      allMessageIds.push(email.inReplyTo);
    }
    
    console.log('🔍 Looking for thread with Message-IDs:', allMessageIds);

    let existingMessage = null;
    
    // If this email has threading headers, search for existing thread
    // by finding any message that matches any of these Message-IDs
    if (allMessageIds.length > 0) {
      existingMessage = await this.prisma.message.findFirst({
        where: {
          messageId: {
            in: allMessageIds,
          },
          thread: {
            listingId: listing.id, // Use actual listing UUID
            senderId: sender.id,
          },
        },
        include: {
          thread: {
            include: {
              listing: true,
              sender: true,
            },
          },
        },
      });
    }
    
    let thread = null;
    // If no thread found (new conversation or couldn't match reply)
    if (!existingMessage) {
      // Create a new thread
      thread = await this.prisma.thread.create({
        data: {
          listingId: listing.id, // Use actual listing UUID
          senderId: sender.id,
          subject: email.subject,
          emailThreadId: emailThreadId || undefined,
          category: this.classifyMessage(email.subject, email.bodyText),
          lastMessageAt: new Date(),
        },
      });
      console.log(`✨ Created new thread: ${thread.id} (${email.subject})`);
    } else {
      // 4. Check for duplicate message before storing
      const isDuplicate = await this.checkForDuplicateMessage({
        senderEmail: email.from,
        subject: email.subject,
        bodyText: email.bodyText,
        threadId: existingMessage.threadId,
        timestamp: email.timestamp,
      });

      if (isDuplicate) {
        console.log('⚠️ Duplicate email detected - skipping message creation');
        return; // Skip creating the message
      }
      // Update existing thread
      thread = await this.prisma.thread.update({
        where: { id: existingMessage.threadId },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
        },
      });
      console.log(`📝 Updated existing thread: ${existingMessage.threadId}`);
    }

    // 5. Store message
    // TODO: Implement when DB is connected
    await this.prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: sender.id,
        senderEmail: email.from,
        senderName: sender.name,
        direction: 'INBOUND',
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        messageId: email.messageId,
      },
    });

    // 6. Upload to Supabase Storage (OPTIONAL - for audit/compliance)
    // Use message ID to keep history of all emails, not just latest per thread
    // NOTE: This stores raw .eml files for legal/debugging purposes
    // You can disable this for MVP if you only need Postgres storage
    // TODO: Implement when Supabase is set up
    // await this.supabaseService.uploadFile(
    //   'emails',
    //   `${listingAlias}/${thread.id}/${message.id}.eml`,
    //   Buffer.from(email.bodyText),
    //   'message/rfc822',
    // );

    // 7. Handle attachments
    // TODO: Implement attachment upload

    // 8. Send push notification
    // TODO: Implement when Expo Push is set up

    console.log('[STUB] Email processed successfully');
  }

  /**
   * Check if a message with the same characteristics already exists
   * Prevents duplicate email ingestion from webhook retries
   */
  private async checkForDuplicateMessage(params: {
    senderEmail: string;
    subject: string;
    bodyText: string;
    threadId: string;
    timestamp: Date;
  }): Promise<boolean> {
    // Look for existing message with same sender, subject, body, thread, and timestamp (within 1 minute)
    // We use a 1-minute window to account for minor timestamp variations
    const oneMinuteBefore = new Date(params.timestamp.getTime() - 60 * 1000);
    const oneMinuteAfter = new Date(params.timestamp.getTime() + 60 * 1000);

    const existingMessage = await this.prisma.message.findFirst({
      where: {
        threadId: params.threadId,
        senderEmail: params.senderEmail,
        subject: params.subject,
        bodyText: params.bodyText,
        createdAt: {
          gte: oneMinuteBefore,
          lte: oneMinuteAfter,
        },
      },
    });

    return existingMessage !== null;
  }

  /**
   * Classify message based on content
   */
  private classifyMessage(subject: string, body: string): MessageCategory {
    const combined = `${subject} ${body}`.toLowerCase();
    
    if (combined.includes('offer') || combined.includes('aps')) {
      return 'OFFER';
    }
    if (combined.includes('showing') || combined.includes('view') || combined.includes('visit')) {
      return 'SHOWING';
    }
    return 'GENERAL';
  }

  private extractNameFromEmail(email: string): string {
    // Extract name from "John Smith <john@example.com>" format
    const match = email.match(/^(.+?)\s*<.*>$/);
    return match ? match[1].trim() : email.split('@')[0];
  }

  private extractDomain(email: string): string {
    return email.split('@')[1] || '';
  }

  private extractEmailThreadId(email: any): string | null {
    if (email.references) {
      const rootMessageId = this.parseReferences(email.references)[0];
      if (rootMessageId) {
        return rootMessageId;
      }
    }

    if (email.inReplyTo) {
      return email.inReplyTo;
    }

    // If no threading headers, use Message-ID to start a new thread
    if (email.messageId) {
      return email.messageId;
    }

    return null;
    
  }

  private parseReferences(references: string): string[] {
    if (!references) return [];
    
    // Match all <...> patterns
    const matches = references.match(/<[^>]+>/g);
    return matches || [];
  }
}

