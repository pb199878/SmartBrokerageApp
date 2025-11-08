import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { SupabaseService } from "../../common/supabase/supabase.service";
import { ApsParserService } from "../aps-parser/aps-parser.service";
import { ApsParseResult } from "@smart-brokerage/shared";
import axios from "axios";
import { PDFParse } from "pdf-parse";

interface OREAFormDetectionResult {
  isOREAForm: boolean;
  formType: string | null;
  confidence: number;
  identifiers: string[];
}

interface ExtractedOfferData {
  // Financial
  price?: number; // Legacy field, maps to purchasePrice
  purchasePrice?: number;
  deposit?: number;
  depositDue?: string;
  balanceDueOnClosing?: number;

  // Dates
  closingDate?: string;
  expiryDate?: string; // Legacy field, maps to irrevocableDate
  possessionDate?: string;
  irrevocableDate?: string;

  // Buyer Info
  buyers?: string[]; // Legacy field
  buyerName?: string;
  buyerAddress?: string;
  buyerPhone?: string;
  buyerEmail?: string;

  // Buyer's Lawyer
  buyerLawyer?: string;
  buyerLawyerAddress?: string;
  buyerLawyerPhone?: string;
  buyerLawyerEmail?: string;

  // Property & Terms
  sellers?: string[]; // Legacy field
  propertyAddress?: string;
  inclusions?: string;
  exclusions?: string;
  conditions?: string[];

  // Condition Details
  financingCondition?: boolean;
  inspectionCondition?: boolean;
  saleOfPropertyCondition?: boolean;
  conditionWaiverDate?: string;

  // Agent Info
  buyerAgentName?: string;
  buyerAgentBrokerage?: string;

  // Signatures
  buyerSignature1Detected?: boolean;
  buyerSignature2Detected?: boolean;
  buyerSignedDate?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationResult {
  validationStatus: "passed" | "failed";
  errors: ValidationError[];
}

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService,
    private apsParserService: ApsParserService
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
    if (!attachment.contentType.includes("pdf")) {
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

      console.log(
        `📝 Extracted ${textContent.length} characters from ${pageCount} pages`
      );

      // Detect OREA form
      const oreaDetection = this.detectOREAForm(textContent);

      // Extract offer data if it's an OREA form
      let extractedData: ExtractedOfferData | null = null;
      let formFieldsExtracted: any = undefined;
      let validationStatus: string | undefined;
      let validationErrors: any = undefined;
      let hasRequiredSignatures: boolean | undefined;
      let priceMatchesExtracted: boolean | undefined;

      if (oreaDetection.isOREAForm) {
        // Use APS parser for comprehensive extraction
        try {
          console.log("🔍 Using APS parser for comprehensive extraction...");

          const apsResult: ApsParseResult =
            await this.apsParserService.parseAps(pdfBuffer);

          // Convert APS result to legacy ExtractedOfferData format
          extractedData = this.convertApsResultToLegacyFormat(apsResult);

          // Store the full APS result in formFieldsExtracted
          formFieldsExtracted = apsResult;

          // Set validation status based on confidence
          if (apsResult.docConfidence > 0.7) {
            validationStatus = "passed";
          } else if (apsResult.docConfidence > 0.4) {
            validationStatus = "needs_review";
          } else {
            validationStatus = "failed";
          }

          // Check for required signatures (would need signature detection)
          hasRequiredSignatures = false; // TODO: Implement signature detection

          // Check if price was extracted
          priceMatchesExtracted =
            !!apsResult.price_and_deposit?.purchase_price?.numeric;

          console.log(
            `✅ APS parser extraction complete. Strategy: ${
              apsResult.strategyUsed
            }, Confidence: ${apsResult.docConfidence.toFixed(2)}`
          );
        } catch (error: any) {
          console.error("❌ APS parser failed, using fallback:", error.message);
          // Fallback to basic extraction
          extractedData = this.extractOfferData(textContent);
          validationStatus = "not_validated";
        }
      }

      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(
        attachment.filename,
        textContent,
        oreaDetection.isOREAForm,
        pageCount
      );

      // Create document analysis record
      const analysis = await this.prisma.documentAnalysis.create({
        data: {
          attachmentId,
          formType: oreaDetection.formType,
          oreaFormDetected: oreaDetection.isOREAForm,
          relevanceScore,
          confidence: oreaDetection.confidence,
          extractedData: extractedData
            ? JSON.parse(JSON.stringify(extractedData))
            : undefined,
          textContent,
          pageCount,
          // Validation fields
          validationStatus,
          validationErrors,
          hasRequiredSignatures,
          priceMatchesExtracted,
          formFieldsExtracted: formFieldsExtracted
            ? JSON.parse(JSON.stringify(formFieldsExtracted))
            : undefined,
        },
      });

      // Update attachment with analysis ID
      await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: { documentAnalysisId: analysis.id },
      });

      console.log(
        `✅ Document analysis complete: ${
          oreaDetection.formType || "Unknown document"
        }`
      );

      return analysis;
    } catch (error) {
      console.error(`❌ Failed to analyze attachment ${attachmentId}:`, error);
      throw error;
    }
  }

  /**
   * Extract text from PDF buffer using pdf-parse
   */
  private async extractPDFText(buffer: Buffer): Promise<any> {
    try {
      // Use pdf-parse for proper text extraction from PDF pages
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();

      console.log(
        `📄 Extracted ${textResult.text.length} characters from ${textResult.total} pages using pdf-parse`
      );

      // Get metadata
      const infoResult = await parser.getInfo();

      return {
        text: textResult.text,
        numpages: textResult.total,
        info: infoResult.info || {},
      };
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      throw error;
    }
  }

  /**
   * Download PDF from Supabase Storage
   */
  private async downloadPDFFromSupabase(s3Key: string): Promise<Buffer> {
    // Get signed URL
    const signedUrl = await this.supabaseService.getSignedUrl(
      "attachments",
      s3Key,
      300
    ); // 5 min

    // Download PDF
    const response = await axios.get(signedUrl, {
      responseType: "arraybuffer",
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
      "ontario real estate association",
      "orea",
      "toronto regional real estate board",
      "trreb",
    ];

    oreaKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        identifiers.push(keyword);
        confidence += 20;
      }
    });

    // Detect specific form types
    if (
      text.includes("agreement of purchase and sale") ||
      text.includes("form 100")
    ) {
      formType = "Form 100 - Agreement of Purchase and Sale";
      confidence += 30;
      identifiers.push("Form 100 APS");
    } else if (
      text.includes("amendment to agreement") ||
      text.includes("form 120")
    ) {
      formType = "Form 120 - Amendment to Agreement";
      confidence += 30;
      identifiers.push("Form 120 Amendment");
    } else if (text.includes("waiver") || text.includes("form 123")) {
      formType = "Form 123 - Waiver";
      confidence += 30;
      identifiers.push("Form 123 Waiver");
    } else if (text.includes("counter offer") || text.includes("form 221")) {
      formType = "Form 221 - Counter Offer";
      confidence += 30;
      identifiers.push("Form 221 Counter Offer");
    } else if (text.includes("mutual release") || text.includes("form 122")) {
      formType = "Form 122 - Mutual Release";
      confidence += 30;
      identifiers.push("Form 122 Release");
    }

    // Additional validation - check for required fields in APS
    if (formType && formType.includes("Form 100")) {
      const requiredFields = [
        "purchase price",
        "deposit",
        "buyer",
        "seller",
        "property",
      ];

      requiredFields.forEach((field) => {
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
      const priceStr = priceMatch[1].replace(/[$,]/g, "");
      data.price = parseFloat(priceStr);
    }

    // Extract deposit
    const depositMatch = textContent.match(/deposit.*?(\$[\d,]+)/i);
    if (depositMatch) {
      const depositStr = depositMatch[1].replace(/[$,]/g, "");
      data.deposit = parseFloat(depositStr);
    }

    // Extract closing date (various formats)
    const closingMatch = textContent.match(
      /completion date.*?(\d{4}-\d{2}-\d{2}|\w+ \d{1,2},? \d{4})/i
    );
    if (closingMatch) {
      data.closingDate = closingMatch[1];
    }

    // Extract expiry date (irrevocable date on OREA forms)
    // Common patterns: "irrevocable", "expires", "expiry", "valid until"
    const expiryMatch = textContent.match(
      /(?:irrevocable|expir(?:y|es)|valid until).*?(\d{4}-\d{2}-\d{2}|\w+ \d{1,2},? \d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    );
    if (expiryMatch) {
      data.expiryDate = expiryMatch[1];
    }

    // Extract conditions
    const conditions: string[] = [];
    if (
      textContent.toLowerCase().includes("subject to") ||
      textContent.toLowerCase().includes("conditional")
    ) {
      // Common conditions
      const conditionKeywords = [
        "financing",
        "home inspection",
        "status certificate",
        "sale of buyer's property",
        "environmental",
      ];

      conditionKeywords.forEach((keyword) => {
        if (textContent.toLowerCase().includes(keyword)) {
          conditions.push(keyword);
        }
      });
    }
    if (conditions.length > 0) {
      data.conditions = conditions;
    }

    // Extract property address
    const addressMatch = textContent.match(
      /property.*?([\d]+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|blvd|boulevard|lane|ln|court|ct))/i
    );
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
    pageCount: number
  ): number {
    let score = 0;

    // Base score for OREA forms
    if (isOREAForm) {
      score += 50;
    }

    // Filename keywords
    const highPriorityKeywords = [
      "offer",
      "aps",
      "form",
      "agreement",
      "amendment",
    ];
    const lowerFilename = filename.toLowerCase();
    highPriorityKeywords.forEach((keyword) => {
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
      "purchase price",
      "deposit",
      "closing date",
      "buyer",
      "seller",
      "property",
      "agreement",
    ];

    const lowerText = textContent.toLowerCase();
    importantKeywords.forEach((keyword) => {
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

  /**
   * Convert APS parser result (Gemini schema) to legacy ExtractedOfferData format
   * for backward compatibility with existing database schema
   */
  private convertApsResultToLegacyFormat(
    apsResult: ApsParseResult
  ): ExtractedOfferData {
    const data: ExtractedOfferData = {};

    // Parties
    if (apsResult.buyer_full_name) {
      data.buyerName = apsResult.buyer_full_name;
      data.buyers = [apsResult.buyer_full_name];
    }

    if (apsResult.seller_full_name) {
      data.sellers = [apsResult.seller_full_name];
    }

    // Property
    data.propertyAddress = apsResult.property?.property_address;

    // Financials
    if (apsResult.price_and_deposit?.purchase_price?.numeric) {
      data.purchasePrice = apsResult.price_and_deposit.purchase_price.numeric;
      data.price = apsResult.price_and_deposit.purchase_price.numeric; // Legacy field
    }

    if (apsResult.price_and_deposit?.deposit?.numeric) {
      data.deposit = apsResult.price_and_deposit.deposit.numeric;
    }

    if (apsResult.price_and_deposit?.deposit?.timing) {
      data.depositDue = apsResult.price_and_deposit.deposit.timing;
    }

    // Dates - format from day/month/year to ISO string
    if (apsResult.completion) {
      data.closingDate = this.formatDateFromParts(apsResult.completion);
    }

    if (apsResult.irrevocability) {
      data.irrevocableDate = this.formatDateFromParts(apsResult.irrevocability);
      data.expiryDate = data.irrevocableDate; // Legacy field
    }

    // Inclusions/Exclusions
    if (apsResult.inclusions_exclusions?.chattels_included) {
      data.inclusions =
        apsResult.inclusions_exclusions.chattels_included.join(", ");
    }

    if (apsResult.inclusions_exclusions?.fixtures_excluded) {
      data.exclusions =
        apsResult.inclusions_exclusions.fixtures_excluded.join(", ");
    }

    // Buyer lawyer info
    if (apsResult.acknowledgment?.buyer?.lawyer) {
      data.buyerLawyer = apsResult.acknowledgment.buyer.lawyer.name;
      data.buyerLawyerEmail = apsResult.acknowledgment.buyer.lawyer.email;
      data.buyerLawyerAddress = apsResult.acknowledgment.buyer.lawyer.address;
    }

    // Buyer contact
    if (apsResult.notices?.buyer_email) {
      data.buyerEmail = apsResult.notices.buyer_email;
    }

    // Signatures - would need to check if signature fields are present
    data.buyerSignature1Detected = false; // TODO: Add signature detection
    data.buyerSignature2Detected = false;

    return data;
  }

  /**
   * Format date from day/month/year parts to ISO string
   */
  private formatDateFromParts(dateParts: {
    day?: string;
    month?: string;
    year?: string;
  }): string | undefined {
    if (!dateParts.day || !dateParts.month || !dateParts.year) {
      return undefined;
    }

    try {
      // Convert month name to number
      const monthNames = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ];

      let monthNum: string;
      const monthLower = dateParts.month.toLowerCase();
      const monthIndex = monthNames.findIndex((m) => monthLower.includes(m));

      if (monthIndex >= 0) {
        monthNum = String(monthIndex + 1).padStart(2, "0");
      } else {
        // Try to parse as number
        const parsed = parseInt(dateParts.month, 10);
        monthNum = isNaN(parsed) ? "01" : String(parsed).padStart(2, "0");
      }

      const day = dateParts.day.replace(/\D/g, "").padStart(2, "0");
      const year =
        dateParts.year.length === 2 ? "20" + dateParts.year : dateParts.year;

      return `${year}-${monthNum}-${day}T12:00:00Z`;
    } catch (error) {
      console.warn("⚠️  Failed to format date:", dateParts);
      return undefined;
    }
  }
}
