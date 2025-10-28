import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import axios from 'axios';

interface OREAFormDetectionResult {
  isOREAForm: boolean;
  formType: string | null;
  confidence: number;
  identifiers: string[];
}

interface ExtractedOfferData {
  price?: number;
  deposit?: number;
  closingDate?: string;
  conditions?: string[];
  buyers?: string[];
  sellers?: string[];
  propertyAddress?: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Analyze a PDF attachment
   * Extracts text, detects OREA forms, and stores analysis results
   */
  async analyzeAttachment(attachmentId: string): Promise<any> {
    console.log(`📄 Analyzing attachment: ${attachmentId}`);

    // Get attachment record
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new Error(`Attachment ${attachmentId} not found`);
    }

    // Skip analysis for non-PDF files
    if (!attachment.contentType.includes('pdf')) {
      console.log(`⏭️  Skipping non-PDF file: ${attachment.filename}`);
      return null;
    }

    try {
      // Download PDF from Supabase
      const pdfBuffer = await this.downloadPDFFromSupabase(attachment.s3Key);

      // Extract text from PDF using dynamic import
      const pdfData = await this.extractPDFText(pdfBuffer);
      const textContent = pdfData.text;
      const pageCount = pdfData.numpages;

      console.log(`📝 Extracted ${textContent.length} characters from ${pageCount} pages`);

      // Detect OREA form
      const oreaDetection = this.detectOREAForm(textContent);

      // Extract offer data if it's an OREA form
      let extractedData: ExtractedOfferData | null = null;
      if (oreaDetection.isOREAForm) {
        extractedData = this.extractOfferData(textContent);
      }

      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(
        attachment.filename,
        textContent,
        oreaDetection.isOREAForm,
        pageCount,
      );

      // Create document analysis record
      const analysis = await this.prisma.documentAnalysis.create({
        data: {
          attachmentId,
          formType: oreaDetection.formType,
          oreaFormDetected: oreaDetection.isOREAForm,
          relevanceScore,
          confidence: oreaDetection.confidence,
          extractedData: extractedData ? JSON.parse(JSON.stringify(extractedData)) : undefined,
          textContent,
          pageCount,
        },
      });

      // Update attachment with analysis ID
      await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: { documentAnalysisId: analysis.id },
      });

      console.log(`✅ Document analysis complete: ${oreaDetection.formType || 'Unknown document'}`);

      return analysis;
    } catch (error) {
      console.error(`❌ Failed to analyze attachment ${attachmentId}:`, error);
      throw error;
    }
  }

  /**
   * Extract text from PDF buffer
   * Wrapped in a method to handle CommonJS/ESM compatibility
   */
  private async extractPDFText(buffer: Buffer): Promise<any> {
    try {
      // pdf-parse exports PDFParse as a class constructor
      const { PDFParse } = require('pdf-parse');
      
      if (!PDFParse) {
        throw new Error('PDFParse class not found in pdf-parse module');
      }
      
      // Instantiate PDFParse class and parse the buffer
      const parser = new PDFParse({data: buffer});
      const data = await parser.getText();
      return data;
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw error;
    }
  }

  /**
   * Download PDF from Supabase Storage
   */
  private async downloadPDFFromSupabase(s3Key: string): Promise<Buffer> {
    // Get signed URL
    const signedUrl = await this.supabaseService.getSignedUrl('attachments', s3Key, 300); // 5 min

    // Download PDF
    const response = await axios.get(signedUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    return Buffer.from(response.data);
  }

  /**
   * Detect if PDF is an OREA form and identify the type
   */
  private detectOREAForm(textContent: string): OREAFormDetectionResult {
    const text = textContent.toLowerCase();
    const identifiers: string[] = [];
    let formType: string | null = null;
    let confidence = 0;

    // Check for OREA identifiers
    const oreaKeywords = [
      'ontario real estate association',
      'orea',
      'toronto regional real estate board',
      'trreb',
    ];

    oreaKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        identifiers.push(keyword);
        confidence += 20;
      }
    });

    // Detect specific form types
    if (text.includes('agreement of purchase and sale') || text.includes('form 100')) {
      formType = 'Form 100 - Agreement of Purchase and Sale';
      confidence += 30;
      identifiers.push('Form 100 APS');
    } else if (text.includes('amendment to agreement') || text.includes('form 120')) {
      formType = 'Form 120 - Amendment to Agreement';
      confidence += 30;
      identifiers.push('Form 120 Amendment');
    } else if (text.includes('waiver') || text.includes('form 123')) {
      formType = 'Form 123 - Waiver';
      confidence += 30;
      identifiers.push('Form 123 Waiver');
    } else if (text.includes('counter offer') || text.includes('form 221')) {
      formType = 'Form 221 - Counter Offer';
      confidence += 30;
      identifiers.push('Form 221 Counter Offer');
    } else if (text.includes('mutual release') || text.includes('form 122')) {
      formType = 'Form 122 - Mutual Release';
      confidence += 30;
      identifiers.push('Form 122 Release');
    }

    // Additional validation - check for required fields in APS
    if (formType && formType.includes('Form 100')) {
      const requiredFields = [
        'purchase price',
        'deposit',
        'buyer',
        'seller',
        'property',
      ];

      requiredFields.forEach(field => {
        if (text.includes(field)) {
          confidence += 2;
        }
      });
    }

    // Cap confidence at 100
    confidence = Math.min(confidence, 100);

    const isOREAForm = identifiers.length > 0 && confidence >= 20;

    return {
      isOREAForm,
      formType,
      confidence,
      identifiers,
    };
  }

  /**
   * Extract offer data from OREA Form 100 (APS)
   */
  private extractOfferData(textContent: string): ExtractedOfferData {
    const data: ExtractedOfferData = {};

    // Extract price
    const priceMatch = textContent.match(/purchase price.*?(\$[\d,]+)/i);
    if (priceMatch) {
      const priceStr = priceMatch[1].replace(/[$,]/g, '');
      data.price = parseFloat(priceStr);
    }

    // Extract deposit
    const depositMatch = textContent.match(/deposit.*?(\$[\d,]+)/i);
    if (depositMatch) {
      const depositStr = depositMatch[1].replace(/[$,]/g, '');
      data.deposit = parseFloat(depositStr);
    }

    // Extract closing date (various formats)
    const closingMatch = textContent.match(/completion date.*?(\d{4}-\d{2}-\d{2}|\w+ \d{1,2},? \d{4})/i);
    if (closingMatch) {
      data.closingDate = closingMatch[1];
    }

    // Extract conditions
    const conditions: string[] = [];
    if (textContent.toLowerCase().includes('subject to') || textContent.toLowerCase().includes('conditional')) {
      // Common conditions
      const conditionKeywords = [
        'financing',
        'home inspection',
        'status certificate',
        'sale of buyer\'s property',
        'environmental',
      ];

      conditionKeywords.forEach(keyword => {
        if (textContent.toLowerCase().includes(keyword)) {
          conditions.push(keyword);
        }
      });
    }
    if (conditions.length > 0) {
      data.conditions = conditions;
    }

    // Extract property address
    const addressMatch = textContent.match(/property.*?([\d]+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|blvd|boulevard|lane|ln|court|ct))/i);
    if (addressMatch) {
      data.propertyAddress = addressMatch[1].trim();
    }

    return data;
  }

  /**
   * Calculate relevance score for a document
   */
  private calculateRelevanceScore(
    filename: string,
    textContent: string,
    isOREAForm: boolean,
    pageCount: number,
  ): number {
    let score = 0;

    // Base score for OREA forms
    if (isOREAForm) {
      score += 50;
    }

    // Filename keywords
    const highPriorityKeywords = ['offer', 'aps', 'form', 'agreement', 'amendment'];
    const lowerFilename = filename.toLowerCase();
    highPriorityKeywords.forEach(keyword => {
      if (lowerFilename.includes(keyword)) {
        score += 8;
      }
    });

    // Content length (longer documents are often more important)
    if (textContent.length > 5000) {
      score += 10;
    } else if (textContent.length > 2000) {
      score += 5;
    }

    // Page count (multi-page documents are usually formal)
    if (pageCount >= 10) {
      score += 15;
    } else if (pageCount >= 5) {
      score += 10;
    } else if (pageCount >= 3) {
      score += 5;
    }

    // Check for important keywords in content
    const importantKeywords = [
      'purchase price',
      'deposit',
      'closing date',
      'buyer',
      'seller',
      'property',
      'agreement',
    ];

    const lowerText = textContent.toLowerCase();
    importantKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score += 2;
      }
    });

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Get analysis for an attachment
   */
  async getAnalysis(attachmentId: string) {
    return this.prisma.documentAnalysis.findFirst({
      where: { attachmentId },
    });
  }

  /**
   * Check if attachment has been analyzed
   */
  async isAnalyzed(attachmentId: string): Promise<boolean> {
    const analysis = await this.getAnalysis(attachmentId);
    return analysis !== null;
  }
}

