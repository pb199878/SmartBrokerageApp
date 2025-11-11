import { Injectable } from "@nestjs/common";
import { ApsParseResult, GeminiApsSchema } from "@smart-brokerage/shared";
import { PDFDocument } from "pdf-lib";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PdfToImageService } from "./pdf-to-image.service";
import {
  SignatureDetectorService,
  VisualValidationResult,
} from "./signature-detector.service";

export interface HybridValidationResult extends ApsParseResult {
  visualValidation?: VisualValidationResult;
  validationStrategy: "text-only" | "text-with-visual" | "visual-only";
  crossValidationScore: number; // 0-1 score indicating agreement between text and visual
}

@Injectable()
export class ApsParserService {
  private genAI: GoogleGenerativeAI | null = null;
  private geminiEnabled: boolean = false;

  constructor(
    private pdfToImageService: PdfToImageService,
    private signatureDetectorService: SignatureDetectorService
  ) {
    // Initialize Gemini AI if API key is available
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.geminiEnabled = true;
      console.log("✅ Gemini AI initialized for APS parsing");
    } else {
      console.log(
        "⚠️  Gemini AI not configured (GOOGLE_GEMINI_API_KEY missing)"
      );
    }
  }

  /**
   * Parse an OREA Form 100 PDF using 3-tier hybrid strategy
   * Tier 1: AcroForm extraction (fillable PDFs)
   * Tier 2: Gemini PDF extraction (flattened/scanned PDFs)
   * Tier 3: Image-based visual validation (signatures, checkboxes, cross-validation)
   */
  async parseAps(pdfBuffer: Buffer): Promise<ApsParseResult> {
    try {
      console.log("📄 Starting APS parsing with hybrid validation...");

      // Try Tier 1: AcroForm extraction
      try {
        const acroformResult = await this.tryAcroFormExtraction(pdfBuffer);
        if (acroformResult && acroformResult.docConfidence > 0.7) {
          console.log(
            "✅ AcroForm extraction successful (confidence:",
            acroformResult.docConfidence,
            ")"
          );
          return acroformResult;
        }
      } catch (error) {
        console.log("⏭️  AcroForm tier failed:", error.message);
      }

      // Tier 2: Gemini PDF extraction
      if (this.geminiEnabled) {
        console.log("🤖 Using Gemini for PDF extraction...");
        try {
          const geminiResult = await this.tryGeminiExtraction(pdfBuffer);
          console.log(
            "✅ Gemini extraction complete (confidence:",
            geminiResult.docConfidence,
            ")"
          );
          return geminiResult;
        } catch (error) {
          console.error("❌ Gemini extraction failed:", error.message);
          throw error;
        }
      } else {
        throw new Error(
          "Gemini AI not configured. Please set GOOGLE_GEMINI_API_KEY environment variable."
        );
      }
    } catch (error) {
      console.error("❌ APS parsing failed completely:", error);
      return {
        success: false,
        strategyUsed: "acroform",
        docConfidence: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * Parse with comprehensive hybrid validation (text + image analysis)
   * This method combines text extraction with visual validation for maximum accuracy
   */
  async parseApsWithHybridValidation(
    pdfBuffer: Buffer
  ): Promise<HybridValidationResult> {
    console.log("🔬 Starting HYBRID validation (text + images)...");

    // Step 1: Standard text-based extraction
    const textResult = await this.parseAps(pdfBuffer);

    // Step 2: Convert PDF to images for visual analysis
    let visualValidation: VisualValidationResult | undefined;
    let validationStrategy: "text-only" | "text-with-visual" | "visual-only" =
      "text-only";
    let crossValidationScore = textResult.docConfidence;

    if (this.geminiEnabled) {
      try {
        console.log("🖼️  Attempting visual validation with images...");
        const images = await this.pdfToImageService.convertPdfToImages(
          pdfBuffer,
          {
            maxPages: 15, // OREA Form 100 is typically 11-13 pages
            quality: 90, // Higher quality for better initials detection
          }
        );

        if (images.length > 0) {
          console.log("🔍 Performing visual validation...");
          visualValidation =
            await this.signatureDetectorService.performVisualValidation(
              images,
              textResult // Pass text result for cross-validation
            );

          validationStrategy = "text-with-visual";

          // Calculate cross-validation score
          crossValidationScore = this.calculateCrossValidationScore(
            textResult,
            visualValidation
          );

          console.log(
            `✅ Hybrid validation complete. Cross-validation score: ${(
              crossValidationScore * 100
            ).toFixed(1)}%`
          );
        }
      } catch (imageError: any) {
        // Graceful fallback to text-only validation
        console.log(
          "⚠️  Image-based validation not available (GraphicsMagick not installed)"
        );
        console.log(
          "   Using text-only validation. To enable image validation:"
        );
        console.log("   - Local: brew install graphicsmagick");
        console.log(
          "   - Railway: Add graphicsmagick buildpack (see HYBRID_VALIDATION_SETUP.md)"
        );
        validationStrategy = "text-only";
        // Use text confidence as cross-validation score
        crossValidationScore = textResult.docConfidence;
      }
    }

    return {
      ...textResult,
      visualValidation,
      validationStrategy,
      crossValidationScore,
    };
  }

  /**
   * Calculate cross-validation score between text and visual analysis
   */
  private calculateCrossValidationScore(
    textResult: ApsParseResult,
    visualValidation: VisualValidationResult
  ): number {
    let score = 0;
    let totalChecks = 0;

    // 1. Check if signatures are present (critical validation)
    totalChecks++;
    if (visualValidation.signatureDetection.hasSignatures) {
      score += 0.4; // Signatures are 40% of validation score
    }

    // 2. Check visual quality
    totalChecks++;
    if (visualValidation.visualQuality.isReadable) {
      score += 0.2; // Quality is 20%
    }

    // 3. Check cross-validation agreement
    totalChecks++;
    if (visualValidation.crossValidation.textMatchesVisual) {
      score += 0.3; // Text/visual agreement is 30%
    } else {
      // Partial credit based on number of discrepancies
      const discrepancyCount =
        visualValidation.crossValidation.discrepancies.length;
      if (discrepancyCount === 0) {
        score += 0.3;
      } else if (discrepancyCount <= 2) {
        score += 0.15; // Minor discrepancies
      }
      // No credit for major discrepancies
    }

    // 4. Incorporate text extraction confidence
    totalChecks++;
    score += textResult.docConfidence * 0.1; // Text confidence is 10%

    return Math.min(score, 1.0);
  }

  /**
   * Tier 1: Extract data from AcroForm fields (fillable PDFs)
   */
  private async tryAcroFormExtraction(
    pdfBuffer: Buffer
  ): Promise<ApsParseResult | null> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      if (fields.length === 0) {
        console.log("⏭️  No AcroForm fields found, skipping tier 1");
        return null;
      }

      console.log(`📋 Found ${fields.length} AcroForm fields`);

      const extractedData: any = {};
      let filledFieldCount = 0;

      // Extract all form fields
      for (const field of fields) {
        const fieldName = field.getName();
        let value: string | boolean | null = null;

        try {
          const fieldType = field.constructor.name;

          if (fieldType === "PDFTextField") {
            const textField = field as any;
            value = textField.getText() || null;
          } else if (fieldType === "PDFCheckBox") {
            const checkbox = field as any;
            value = checkbox.isChecked();
          } else if (fieldType === "PDFRadioGroup") {
            const radio = field as any;
            value = radio.getSelected() || null;
          } else if (fieldType === "PDFDropdown") {
            const dropdown = field as any;
            value = dropdown.getSelected()?.[0] || null;
          }

          if (value !== null && value !== "") {
            extractedData[fieldName] = value;
            filledFieldCount++;
          }
        } catch (err) {
          console.warn(
            `⚠️  Failed to extract field ${fieldName}:`,
            err.message
          );
        }
      }

      // Convert to ApsParseResult format
      const result = this.convertAcroFormToApsResult(extractedData);
      result.docConfidence = filledFieldCount / Math.max(fields.length, 1);

      return result;
    } catch (error) {
      console.log("⏭️  AcroForm extraction failed:", error.message);
      return null;
    }
  }

  /**
   * Tier 2: Extract data using Gemini Vision API with PDF as inline data
   */
  private async tryGeminiExtraction(
    pdfBuffer: Buffer
  ): Promise<ApsParseResult> {
    try {
      console.log(`📄 Preparing PDF for Gemini (${pdfBuffer.length} bytes)`);

      // Prepare Gemini model (2.0 Flash supports PDFs)
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
      });

      // Build the structured prompt
      const schemaJson = JSON.stringify(this.getGeminiSchema(), null, 2);
      const prompt = `You are parsing an OREA Form 100 (Agreement of Purchase and Sale) for Ontario real estate.

Extract ALL information from this document and return ONLY valid JSON matching this EXACT schema:

${schemaJson}

CRITICAL INSTRUCTIONS:
1. Focus on BUYER-related fields - these are the most important
2. Extract numbers EXACTLY as written (e.g., if it says "675,000" extract 675000)
3. For dates, extract day/month/year/time separately as clean strings:
   - Day: Just the number without "st", "nd", "rd", "th" (e.g., "11" not "11th")
   - Month: Full month name (e.g., "November")
   - Year: 4-digit year (e.g., "2025")
   - Time: 24-hour format or 12-hour with AM/PM (e.g., "12:00" or "5:00 PM")
4. If a field is not present, unclear, or empty, use null
5. For arrays (chattels, fixtures, rentals), extract each item separately
6. For HST field, return either "included" or "excluded" based on which checkbox is marked
7. Return ONLY the JSON object, no markdown formatting, no explanations
8. Ensure all numeric fields are actual numbers, not strings
9. Remove extra spaces and normalize text formatting

Return the JSON now:`;

      // Send to Gemini with PDF as inline base64 data
      console.log("🤖 Sending PDF to Gemini Vision API...");

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBuffer.toString("base64"),
          },
        },
      ]);
      const response = result.response;
      const text = response.text();

      console.log("📥 Received response from Gemini");

      // Parse JSON response
      let geminiData: GeminiApsSchema;
      try {
        // Remove markdown code blocks if present
        const cleanedText = text
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        geminiData = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error("❌ Failed to parse Gemini response as JSON:", text);
        throw new Error("Gemini returned invalid JSON: " + parseError.message);
      }

      // Convert Gemini schema to ApsParseResult
      const apsResult = this.convertGeminiSchemaToApsResult(geminiData);

      console.log(
        "✅ Successfully converted Gemini response to ApsParseResult"
      );

      return apsResult;
    } catch (error) {
      console.error("❌ Gemini extraction failed:", error);
      throw error;
    }
  }

  /**
   * Get the Gemini schema definition
   */
  private getGeminiSchema(): any {
    return {
      agreement_date: {
        day: "string",
        month: "string",
        year: "string",
      },
      buyer_full_name: "string",
      seller_full_name: "string",
      property: {
        property_address: "string",
        property_fronting: "string",
        property_side_of_street: "string",
        property_frontage: "string",
        property_depth: "string",
        property_legal_description: "string",
      },
      price_and_deposit: {
        purchase_price: {
          numeric: "number",
          written: "string",
          currency: "string",
        },
        deposit: {
          numeric: "number",
          written: "string",
          timing: "string",
          currency: "string",
        },
      },
      irrevocability: {
        by_whom: "string",
        time: "string",
        day: "string",
        month: "string",
        year: "string",
      },
      completion: {
        day: "string",
        month: "string",
        year: "string",
      },
      notices: {
        seller_fax: "string",
        seller_email: "string",
        buyer_fax: "string",
        buyer_email: "string",
      },
      inclusions_exclusions: {
        chattels_included: ["string"],
        fixtures_excluded: ["string"],
        rental_items: ["string"],
      },
      hst: "included or excluded (string)",
      title_search: {
        day: "string",
        month: "string",
        year: "string",
      },
      acknowledgment: {
        buyer: {
          name: "string",
          date: "string",
          lawyer: {
            name: "string",
            address: "string",
            email: "string",
          },
        },
      },
      commission_trust: {
        cooperatingBrokerageSignature: "string",
      },
    };
  }

  /**
   * Convert Gemini schema to ApsParseResult format
   */
  private convertGeminiSchemaToApsResult(
    geminiData: GeminiApsSchema
  ): ApsParseResult {
    // Calculate confidence based on how many fields were filled
    const totalFields = this.countTotalFields(geminiData);
    const filledFields = this.countFilledFields(geminiData);
    const docConfidence = filledFields / Math.max(totalFields, 1);

    // Return Gemini schema directly as ApsParseResult
    return {
      success: true,
      formVersion: "OREA Form 100 (2020)",
      strategyUsed: "gemini",
      docConfidence,

      // Gemini schema fields (direct mapping)
      agreement_date: geminiData.agreement_date,
      buyer_full_name: geminiData.buyer_full_name,
      seller_full_name: geminiData.seller_full_name,
      property: geminiData.property,
      price_and_deposit: geminiData.price_and_deposit,
      irrevocability: geminiData.irrevocability,
      completion: geminiData.completion,
      notices: geminiData.notices,
      inclusions_exclusions: geminiData.inclusions_exclusions,
      hst: geminiData.hst,
      title_search: geminiData.title_search,
      acknowledgment: geminiData.acknowledgment,
      commission_trust: geminiData.commission_trust,
    };
  }

  /**
   * Convert AcroForm data to ApsParseResult format
   */
  private convertAcroFormToApsResult(formData: any): ApsParseResult {
    // Map form field names to Gemini schema format
    // This would need to be customized based on actual AcroForm field names
    return {
      success: true,
      formVersion: "OREA Form 100",
      strategyUsed: "acroform",
      docConfidence: 0.8,
      buyer_full_name: formData.buyer_name,
      seller_full_name: formData.seller_name,
      property: {
        property_address: formData.property_address,
        property_fronting: formData.property_fronting,
        property_side_of_street: formData.property_side,
        property_frontage: formData.property_frontage,
        property_depth: formData.property_depth,
        property_legal_description: formData.property_legal_desc,
      },
      price_and_deposit: {
        purchase_price: {
          numeric: formData.purchase_price || 0,
          written: formData.purchase_price_words || "",
          currency: "CAD",
        },
        deposit: {
          numeric: formData.deposit || 0,
          written: formData.deposit_words || "",
          timing: formData.deposit_timing || "",
          currency: "CAD",
        },
      },
    };
  }

  /**
   * Count total fields in Gemini schema
   */
  private countTotalFields(data: GeminiApsSchema): number {
    let count = 0;

    // Count top-level fields
    if (data.buyer_full_name !== undefined) count++;
    if (data.seller_full_name !== undefined) count++;

    // Count nested fields
    if (data.property) count += Object.keys(data.property).length;
    if (data.price_and_deposit) count += 2; // purchase_price and deposit
    if (data.irrevocability) count++;
    if (data.completion) count++;
    if (data.notices) count += 4;
    if (data.inclusions_exclusions) count += 3;
    if (data.acknowledgment?.buyer) count += 3;

    return count;
  }

  /**
   * Count filled (non-null) fields in Gemini schema
   */
  private countFilledFields(data: GeminiApsSchema): number {
    let count = 0;

    if (data.buyer_full_name) count++;
    if (data.seller_full_name) count++;

    if (data.property) {
      if (data.property.property_address) count++;
      if (data.property.property_fronting) count++;
      if (data.property.property_side_of_street) count++;
      if (data.property.property_frontage) count++;
      if (data.property.property_depth) count++;
      if (data.property.property_legal_description) count++;
    }

    if (data.price_and_deposit) {
      if (data.price_and_deposit.purchase_price?.numeric) count++;
      if (data.price_and_deposit.deposit?.numeric) count++;
    }

    if (data.irrevocability?.day) count++;
    if (data.completion?.day) count++;

    if (data.notices) {
      if (data.notices.seller_email) count++;
      if (data.notices.buyer_email) count++;
      if (data.notices.seller_fax) count++;
      if (data.notices.buyer_fax) count++;
    }

    if (data.inclusions_exclusions) {
      if (data.inclusions_exclusions.chattels_included?.length) count++;
      if (data.inclusions_exclusions.fixtures_excluded?.length) count++;
      if (data.inclusions_exclusions.rental_items?.length) count++;
    }

    if (data.acknowledgment?.buyer) {
      if (data.acknowledgment.buyer.name) count++;
      if (data.acknowledgment.buyer.lawyer?.name) count++;
      if (data.acknowledgment.buyer.lawyer?.email) count++;
    }

    return count;
  }
}
