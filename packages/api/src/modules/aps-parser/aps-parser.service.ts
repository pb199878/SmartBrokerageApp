import { Injectable } from "@nestjs/common";
import { ApsParseResult, GeminiApsSchema } from "@smart-brokerage/shared";
import { PDFDocument } from "pdf-lib";
import { GoogleGenerativeAI } from "@google/generative-ai";

const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const { createCanvas } = require("canvas");

@Injectable()
export class ApsParserService {
  private genAI: GoogleGenerativeAI | null = null;
  private geminiEnabled: boolean = false;

  constructor() {
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
   * Parse an OREA Form 100 PDF using 2-tier strategy
   * Tier 1: AcroForm extraction (fillable PDFs)
   * Tier 2: Gemini Vision (flattened/scanned PDFs)
   */
  async parseAps(pdfBuffer: Buffer): Promise<ApsParseResult> {
    try {
      console.log("📄 Starting APS parsing...");

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

      // Tier 2: Gemini Vision
      if (this.geminiEnabled) {
        console.log("🤖 Using Gemini Vision for extraction...");
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
   * Tier 2: Extract data using Gemini Vision API
   */
  private async tryGeminiExtraction(
    pdfBuffer: Buffer
  ): Promise<ApsParseResult> {
    try {
      // Convert PDF to images (first 3 pages - most critical info)
      const images = await this.convertPdfToImages(pdfBuffer, 3);
      console.log(`📸 Converted ${images.length} pages to images`);

      // Prepare Gemini model
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

      // Build the structured prompt
      const schemaJson = JSON.stringify(this.getGeminiSchema(), null, 2);
      const prompt = `You are parsing an OREA Form 100 (Agreement of Purchase and Sale) for Ontario real estate.

Extract ALL information from this document and return ONLY valid JSON matching this EXACT schema:

${schemaJson}

CRITICAL INSTRUCTIONS:
1. Focus on BUYER-related fields - these are the most important
2. Extract numbers EXACTLY as written (e.g., if it says "675,000" extract 675000)
3. For dates, extract day/month/year separately as strings
4. If a field is not present, unclear, or empty, use null
5. For arrays (chattels, fixtures, rentals), extract each item separately
6. For HST field, return either "included" or "excluded" based on which checkbox is marked
7. Return ONLY the JSON object, no markdown formatting, no explanations
8. Ensure all numeric fields are actual numbers, not strings

Return the JSON now:`;

      // Send to Gemini with images
      console.log("🤖 Sending to Gemini Vision API...");

      const imageParts = images.map((imageData) => ({
        inlineData: {
          data: imageData.toString("base64"),
          mimeType: "image/png",
        },
      }));

      const result = await model.generateContent([prompt, ...imageParts]);
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
   * Convert PDF pages to PNG images for Gemini
   */
  private async convertPdfToImages(
    pdfBuffer: Buffer,
    maxPages: number = 3
  ): Promise<Buffer[]> {
    const uint8Array = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDoc = await loadingTask.promise;

    const images: Buffer[] = [];
    const pagesToProcess = Math.min(pdfDoc.numPages, maxPages);

    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // High resolution for better OCR

      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );
      const context = canvas.getContext("2d");

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const imageBuffer = canvas.toBuffer("image/png");
      images.push(imageBuffer);
    }

    return images;
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
