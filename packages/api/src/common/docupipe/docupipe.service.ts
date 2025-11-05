import { Injectable } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import {
  DocuPipeOREAForm100Response,
  DocuPipeUploadResponse,
  DocuPipeJobStatusResponse,
  DocuPipeExtractionResponse,
  DocuPipeStandardizeResponse,
  DocuPipeStandardizationResult,
  DocuPipeListSchemasResponse,
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
  private schemaId: string;
  private schemaName: string;
  private schemaIdCache: string | null = null; // Cache for auto-resolved schema ID

  constructor() {
    this.apiKey = process.env.DOCUPIPE_API_KEY || "";
    this.apiUrl = process.env.DOCUPIPE_API_URL || "https://app.docupipe.ai";
    this.schemaId = process.env.DOCUPIPE_SCHEMA_ID || "";
    this.schemaName = process.env.DOCUPIPE_SCHEMA_NAME || "APS Schema V2"; // Default schema name

    if (!this.apiKey) {
      console.warn(
        "⚠️  DOCUPIPE_API_KEY not configured - using basic extraction"
      );
    } else {
      console.log("✓ DocuPipe.ai integration enabled");
      if (this.schemaId) {
        console.log(`✓ Using schema ID: ${this.schemaId}`);
      } else if (this.schemaName) {
        console.log(`✓ Will auto-resolve schema by name: "${this.schemaName}"`);
      } else {
        console.warn("⚠️  No schema configured - using generic extraction");
      }
    }

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "X-API-Key": this.apiKey, // DocuPipe uses X-API-Key header
      },
      timeout: 60000, // 60 second timeout
      // Force IPv4 to avoid some DNS issues
      family: 4,
    });
  }

  /**
   * Upload PDF to DocuPipe for analysis
   * Returns jobId and documentId for polling and standardization
   */
  async analyzeDocument(
    pdfBuffer: Buffer,
    filename: string = "document.pdf"
  ): Promise<{ jobId: string; documentId: string }> {
    try {
      console.log("📤 Uploading PDF to DocuPipe.ai...");

      // Convert buffer to base64 as per DocuPipe API docs
      const base64Content = pdfBuffer.toString("base64");

      const response = await this.client.post<DocuPipeUploadResponse>(
        "/document",
        {
          document: {
            file: {
              contents: base64Content,
              filename: filename,
            },
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
          },
        }
      );

      const { jobId, documentId } = response.data;
      console.log(
        `✅ DocuPipe upload successful. Job ID: ${jobId}, Document ID: ${documentId}`
      );

      return { jobId, documentId };
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
   * Returns current status: 'processing' | 'completed' | 'failed' | 'error'
   */
  async pollJobStatus(
    jobId: string
  ): Promise<"processing" | "completed" | "failed" | "error"> {
    try {
      const response = await this.client.get<DocuPipeJobStatusResponse>(
        `/job/${jobId}`
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
   * Get extraction results after job completes (legacy method - without schema)
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
   * List all schemas from DocuPipe
   * Note: This endpoint might not be available on all DocuPipe plans
   */
  async listSchemas(): Promise<DocuPipeListSchemasResponse> {
    try {
      const response = await this.client.get<DocuPipeListSchemasResponse>(
        "/schemas"
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ DocuPipe list schemas failed:", error.message);
      if (error.response?.status === 405) {
        console.error(
          "   HTTP 405: Method Not Allowed - Your DocuPipe plan might not support listing schemas via API"
        );
        console.error(
          "   Please set DOCUPIPE_SCHEMA_ID directly in your .env file"
        );
      }
      throw new Error(`DocuPipe list schemas failed: ${error.message}`);
    }
  }

  /**
   * Find schema ID by name
   * Caches result to avoid repeated API calls
   * Returns null if API doesn't support listing schemas
   */
  async findSchemaIdByName(name: string): Promise<string | null> {
    try {
      console.log(`🔍 Looking up schema ID for: "${name}"`);

      const schemas = await this.listSchemas();
      // Response is an array directly, not wrapped in { schemas: [...] }
      const schema = schemas.find(
        (s) => s.name.toLowerCase() === name.toLowerCase()
      );

      if (schema) {
        console.log(`✅ Found schema: "${schema.name}" (ID: ${schema.id})`);
        return schema.id;
      }

      console.warn(`⚠️  Schema "${name}" not found in DocuPipe`);
      if (schemas && schemas.length > 0) {
        console.log(
          "Available schemas:",
          schemas.map((s) => s.name).join(", ")
        );
      }
      return null;
    } catch (error: any) {
      console.error("❌ Failed to lookup schema:", error.message);
      console.error(
        "   Consider setting DOCUPIPE_SCHEMA_ID directly instead of DOCUPIPE_SCHEMA_NAME"
      );
      return null;
    }
  }

  /**
   * Get schema ID - either from config or by auto-resolving from name
   * Caches the result after first lookup
   */
  async getSchemaId(providedSchemaId?: string): Promise<string> {
    // 1. Use provided schema ID
    if (providedSchemaId) {
      return providedSchemaId;
    }

    // 2. Use configured schema ID
    if (this.schemaId) {
      return this.schemaId;
    }

    // 3. Use cached schema ID (from previous lookup)
    if (this.schemaIdCache) {
      return this.schemaIdCache;
    }

    // 4. Auto-resolve from schema name
    if (this.schemaName) {
      const resolvedId = await this.findSchemaIdByName(this.schemaName);
      if (resolvedId) {
        this.schemaIdCache = resolvedId; // Cache it
        return resolvedId;
      }
    }

    throw new Error(
      "Schema ID could not be determined. Either set DOCUPIPE_SCHEMA_ID, DOCUPIPE_SCHEMA_NAME, or pass schemaId parameter."
    );
  }

  /**
   * Standardize documents using a schema
   * Returns standardizationJobId and standardizationIds for polling
   */
  async standardizeDocuments(
    documentIds: string[],
    schemaId?: string
  ): Promise<{ jobId: string; standardizationIds: string[] }> {
    try {
      const schemaToUse = await this.getSchemaId(schemaId);

      console.log(
        `📊 Standardizing ${documentIds.length} document(s) with schema: ${schemaToUse}...`
      );

      const response = await this.client.post<DocuPipeStandardizeResponse>(
        "/v2/standardize/batch",
        {
          schemaId: schemaToUse,
          documentIds: documentIds,
        },
        {
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
          },
        }
      );

      const { jobId, standardizationIds } = response.data;
      console.log(`✅ Standardization job created. Job ID: ${jobId}`);

      return { jobId, standardizationIds };
    } catch (error: any) {
      console.error("❌ DocuPipe standardization failed:", error.message);
      throw new Error(`DocuPipe standardization failed: ${error.message}`);
    }
  }

  /**
   * Get standardization results after job completes
   * Returns standardized data matching the schema
   */
  async getStandardizationResults(
    standardizationId: string
  ): Promise<DocuPipeOREAForm100Response> {
    try {
      console.log("📥 Retrieving DocuPipe standardization results...");

      const response = await this.client.get<DocuPipeStandardizationResult>(
        `/standardization/${standardizationId}`
      );

      console.log("✅ DocuPipe standardization results retrieved");
      return response.data.data;
    } catch (error: any) {
      console.error(
        "❌ DocuPipe standardization retrieval failed:",
        error.message
      );
      throw new Error(
        `DocuPipe standardization retrieval failed: ${error.message}`
      );
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
   * Complete analysis workflow with standardization:
   * upload → poll → standardize → poll → retrieve → extract
   * Returns extracted offer data using the configured schema
   */
  async analyzeAndExtract(
    pdfBuffer: Buffer,
    filename: string = "document.pdf"
  ): Promise<{
    jobId: string;
    documentId: string;
    standardizationId?: string;
    extractedData: ExtractedOfferData;
    rawResponse: DocuPipeOREAForm100Response;
  }> {
    // Step 1: Upload document
    const { jobId, documentId } = await this.analyzeDocument(
      pdfBuffer,
      filename
    );

    // Step 2: Poll until document parsing completes
    await this.waitForCompletion(jobId);

    let rawResponse: DocuPipeOREAForm100Response;
    let standardizationId: string | undefined;

    // Step 3: If schema is configured (by ID or name), use standardization workflow
    const hasSchema = !!(
      this.schemaId ||
      this.schemaName ||
      this.schemaIdCache
    );

    if (hasSchema) {
      try {
        console.log("🔍 Using standardization workflow with schema...");

        // Standardize the document (will auto-resolve schema ID if needed)
        const { jobId: stdJobId, standardizationIds } =
          await this.standardizeDocuments([documentId]);

        // Poll until standardization completes
        await this.waitForCompletion(stdJobId);

        // Get standardization results
        standardizationId = standardizationIds[0];
        rawResponse = await this.getStandardizationResults(standardizationId);

        console.log("✅ Standardization workflow complete");
      } catch (error: any) {
        console.error(
          "❌ Standardization failed, falling back to legacy extraction:",
          error.message
        );
        // Fallback to legacy extraction
        rawResponse = await this.getExtractionResults(jobId);
      }
    } else {
      // Fallback: Use legacy extraction without schema
      console.log("⚠️  No schema configured, using legacy extraction");
      rawResponse = await this.getExtractionResults(jobId);
    }

    // Extract data
    const extractedData = this.extractComprehensiveOfferData(rawResponse);

    return {
      jobId,
      documentId,
      standardizationId,
      extractedData,
      rawResponse,
    };
  }

  /**
   * Legacy method: Complete analysis workflow without standardization
   * upload → poll → retrieve → extract
   * Returns extracted offer data (no schema applied)
   */
  async analyzeAndExtractLegacy(pdfBuffer: Buffer): Promise<{
    jobId: string;
    extractedData: ExtractedOfferData;
    rawResponse: DocuPipeOREAForm100Response;
  }> {
    // Upload
    const { jobId } = await this.analyzeDocument(pdfBuffer);

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
