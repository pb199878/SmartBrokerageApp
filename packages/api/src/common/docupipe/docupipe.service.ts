import { Injectable } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import {
  DocuPipeOREAForm100Response,
  DocuPipeUploadResponse,
  DocuPipeJobStatusResponse,
  DocuPipeExtractionResponse,
  SignatureInfo,
} from "./types";

interface ExtractedOfferData {
  // Financial
  purchasePrice?: number;
  deposit?: number;
  depositDue?: string;
  balanceDueOnClosing?: number;

  // Dates
  closingDate?: string;
  possessionDate?: string;
  irrevocableDate?: string;

  // Buyer Info
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

@Injectable()
export class DocuPipeService {
  private client: AxiosInstance;
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.DOCUPIPE_API_KEY || "";
    this.apiUrl = process.env.DOCUPIPE_API_URL || "https://app.docupipe.ai";

    if (!this.apiKey) {
      console.warn(
        "⚠️  DOCUPIPE_API_KEY not configured - using basic extraction"
      );
    } else {
      console.log("✓ DocuPipe.ai integration enabled");
    }

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      timeout: 60000, // 60 second timeout
      // Force IPv4 to avoid some DNS issues
      family: 4,
    });
  }

  /**
   * Upload PDF to DocuPipe for analysis
   * Returns jobId for polling
   */
  async analyzeDocument(pdfBuffer: Buffer): Promise<string> {
    try {
      console.log("📤 Uploading PDF to DocuPipe.ai...");

      const response = await this.client.post<DocuPipeUploadResponse>(
        "/api/documents",
        pdfBuffer,
        {
          headers: {
            "Content-Type": "application/pdf",
          },
        }
      );

      const jobId = response.data.jobId;
      console.log(`✅ DocuPipe upload successful. Job ID: ${jobId}`);

      return jobId;
    } catch (error: any) {
      // Provide helpful error messages
      if (error.code === "ENOTFOUND") {
        console.error(
          "❌ DocuPipe service unavailable: DNS lookup failed for",
          this.apiUrl
        );
        console.error(
          "   This usually means the service is not configured or doesn't exist."
        );
        console.error(
          "   Disable DOCUPIPE_API_KEY in .env to use basic extraction."
        );
        throw new Error(
          `DocuPipe service unavailable (DNS lookup failed). Please disable DOCUPIPE_API_KEY or configure a valid endpoint.`
        );
      }

      console.error("❌ DocuPipe upload failed:", error.message);
      throw new Error(`DocuPipe upload failed: ${error.message}`);
    }
  }

  /**
   * Poll job status
   * Returns current status: 'processing' | 'completed' | 'failed'
   */
  async pollJobStatus(
    jobId: string
  ): Promise<"processing" | "completed" | "failed"> {
    try {
      const response = await this.client.get<DocuPipeJobStatusResponse>(
        `/api/documents/${jobId}`
      );

      return response.data.status;
    } catch (error: any) {
      console.error("❌ DocuPipe status check failed:", error.message);
      throw new Error(`DocuPipe status check failed: ${error.message}`);
    }
  }

  /**
   * Poll until job completes with exponential backoff
   * Max wait time: 60 seconds
   */
  async waitForCompletion(jobId: string): Promise<void> {
    const maxWaitTime = 60000; // 60 seconds
    const startTime = Date.now();
    let backoff = 1000; // Start with 1 second

    while (true) {
      const status = await this.pollJobStatus(jobId);

      if (status === "completed") {
        console.log("✅ DocuPipe processing completed");
        return;
      }

      if (status === "failed") {
        throw new Error("DocuPipe processing failed");
      }

      // Check timeout
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error("DocuPipe processing timeout (60s)");
      }

      // Wait with exponential backoff
      console.log(`⏳ DocuPipe still processing... waiting ${backoff}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoff));

      // Increase backoff (1s → 2s → 4s → 8s → 16s → 30s)
      backoff = Math.min(backoff * 2, 30000);
    }
  }

  /**
   * Get extraction results after job completes
   * Returns full DocuPipe OREA Form 100 response
   */
  async getExtractionResults(
    jobId: string
  ): Promise<DocuPipeOREAForm100Response> {
    try {
      console.log("📥 Retrieving DocuPipe extraction results...");

      const response = await this.client.get<DocuPipeExtractionResponse>(
        `/api/documents/${jobId}/results`
      );

      console.log("✅ DocuPipe extraction results retrieved");
      return response.data.data;
    } catch (error: any) {
      console.error("❌ DocuPipe results retrieval failed:", error.message);
      throw new Error(`DocuPipe results retrieval failed: ${error.message}`);
    }
  }

  /**
   * Detect buyer signatures from DocuPipe response
   */
  detectSignatures(response: DocuPipeOREAForm100Response): SignatureInfo {
    const buyerSignatures = response.signatures?.buyer || [];

    const buyerSignature1Detected =
      buyerSignatures.length > 0 &&
      !!buyerSignatures[0]?.name &&
      buyerSignatures[0].name.trim() !== "";

    const buyerSignature2Detected =
      buyerSignatures.length > 1 &&
      !!buyerSignatures[1]?.name &&
      buyerSignatures[1].name.trim() !== "";

    return {
      buyerSignature1Detected,
      buyerSignature2Detected,
    };
  }

  /**
   * Convert DocuPipe date object to ISO string
   */
  private convertDate(dateObj?: {
    day?: string;
    month?: string;
    year?: string;
  }): string | undefined {
    if (!dateObj || !dateObj.day || !dateObj.month || !dateObj.year) {
      return undefined;
    }

    try {
      // Pad day and month with leading zeros
      const day = dateObj.day.padStart(2, "0");
      const month = dateObj.month.padStart(2, "0");
      const year = dateObj.year;

      // Return ISO date string (YYYY-MM-DD)
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn("Failed to convert date:", dateObj);
      return undefined;
    }
  }

  /**
   * Extract comprehensive offer data from DocuPipe response
   * Maps DocuPipe schema to our ExtractedOfferData interface
   */
  extractComprehensiveOfferData(
    response: DocuPipeOREAForm100Response
  ): ExtractedOfferData {
    const data: ExtractedOfferData = {};

    // Financial Details
    if (response.financialDetails) {
      data.purchasePrice = response.financialDetails.purchasePrice?.amount;
      data.deposit = response.financialDetails.deposit?.amount;
      data.depositDue =
        response.financialDetails.deposit?.timing ||
        (response.financialDetails.deposit?.timing === "Herewith"
          ? "Herewith"
          : "Upon Acceptance");
    }

    // Dates
    if (response.terms) {
      data.closingDate = this.convertDate(response.terms.completion?.date);
      data.irrevocableDate = this.convertDate(
        response.terms.irrevocability?.date
      );
      // possessionDate is usually same as closingDate unless specified otherwise
      data.possessionDate = data.closingDate;
    }

    // Buyer Info
    if (response.parties) {
      data.buyerName = response.parties.buyer;
    }

    if (
      response.acknowledgement?.buyer &&
      response.acknowledgement.buyer.length > 0
    ) {
      const buyerAck = response.acknowledgement.buyer[0];
      data.buyerAddress = buyerAck.addressForService;
      data.buyerPhone = buyerAck.phone;
    }

    if (response.notices?.buyer) {
      data.buyerEmail = response.notices.buyer.email;
    }

    // Buyer's Lawyer
    if (response.lawyerInfo?.buyer) {
      const lawyer = response.lawyerInfo.buyer;
      data.buyerLawyer = lawyer.name;
      data.buyerLawyerAddress = lawyer.address;
      data.buyerLawyerPhone = lawyer.phone;
      data.buyerLawyerEmail = lawyer.email;
    }

    // Property & Terms
    if (response.property) {
      data.propertyAddress = response.property.address;
    }

    if (response.terms) {
      data.inclusions = response.terms.chattelsIncluded;
      data.exclusions = response.terms.fixturesExcluded;
    }

    // Conditions (from schedules - would need parsing)
    // For now, just note if Schedule A is attached
    if (response.schedules && response.schedules.includes("A")) {
      data.conditions = ["See Schedule A"];
    }

    // Agent Info
    if (response.brokerageInfo?.buyerBrokerage) {
      data.buyerAgentName = response.brokerageInfo.buyerBrokerage.agent;
      data.buyerAgentBrokerage = response.brokerageInfo.buyerBrokerage.name;
    }

    // Signatures
    const signatures = this.detectSignatures(response);
    data.buyerSignature1Detected = signatures.buyerSignature1Detected;
    data.buyerSignature2Detected = signatures.buyerSignature2Detected;

    if (response.signatures?.buyer && response.signatures.buyer.length > 0) {
      data.buyerSignedDate = response.signatures.buyer[0].date;
    }

    return data;
  }

  /**
   * Complete analysis workflow: upload → poll → retrieve → extract
   * Returns extracted offer data
   */
  async analyzeAndExtract(pdfBuffer: Buffer): Promise<{
    jobId: string;
    extractedData: ExtractedOfferData;
    rawResponse: DocuPipeOREAForm100Response;
  }> {
    // Upload
    const jobId = await this.analyzeDocument(pdfBuffer);

    // Poll until complete
    await this.waitForCompletion(jobId);

    // Get results
    const rawResponse = await this.getExtractionResults(jobId);

    // Extract data
    const extractedData = this.extractComprehensiveOfferData(rawResponse);

    return {
      jobId,
      extractedData,
      rawResponse,
    };
  }
}
