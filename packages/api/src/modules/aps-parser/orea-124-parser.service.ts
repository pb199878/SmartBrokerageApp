import { Injectable } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Orea124ParseResult } from "@smart-brokerage/shared";

@Injectable()
export class Orea124ParserService {
  private genAI: GoogleGenerativeAI | null = null;
  private geminiEnabled: boolean = false;

  constructor() {
    // Initialize Gemini AI if API key is available
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.geminiEnabled = true;
      console.log("✅ Gemini AI initialized for OREA 124 parsing");
    } else {
      console.log(
        "⚠️  Gemini AI not configured (GOOGLE_GEMINI_API_KEY missing)"
      );
    }
  }

  /**
   * Parse an OREA Form 124 (Notice of Fulfillment or Waiver) PDF
   */
  async parseOrea124(pdfBuffer: Buffer): Promise<Orea124ParseResult> {
    if (!this.geminiEnabled) {
      return {
        success: false,
        fulfilledConditions: [],
        errors: [
          "Gemini AI not configured. Please set GOOGLE_GEMINI_API_KEY environment variable.",
        ],
      };
    }

    try {
      console.log(`📄 Parsing OREA 124 form (${pdfBuffer.length} bytes)`);

      // Prepare Gemini model
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
      });

      // Build the structured prompt
      const schemaJson = JSON.stringify(this.getOrea124Schema(), null, 2);
      const prompt = `You are parsing an OREA Form 124 (Notice of Fulfillment or Waiver) for Ontario real estate.

This form is used by buyers to notify sellers that conditions in an Agreement of Purchase and Sale have been fulfilled or waived.

Extract ALL information from this document and return ONLY valid JSON matching this EXACT schema:

${schemaJson}

CRITICAL INSTRUCTIONS:
1. Extract the document date if present (when the notice was signed)
2. Extract EACH fulfilled or waived condition as a separate item in the array
3. Include the COMPLETE, VERBATIM description text for each condition (copy the exact wording from the document)
4. Do NOT abbreviate, summarize, or paraphrase the condition text - preserve all legal language exactly as written
5. This is critical for matching conditions back to the original Agreement of Purchase and Sale
6. If there are notes or additional details about a condition, include them in the "note" field
7. Common conditions include: financing, home inspection, status certificate, sale of buyer's property, etc.
8. If a field is not present, unclear, or empty, use null
9. Return ONLY the JSON object, no markdown formatting, no explanations
10. Remove extra spaces and normalize text formatting

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
      let geminiData: any;
      try {
        // Remove markdown code blocks if present
        const cleanedText = text
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        geminiData = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error("❌ Failed to parse Gemini response as JSON:", text);
        return {
          success: false,
          fulfilledConditions: [],
          errors: [`Failed to parse Gemini response: ${parseError.message}`],
        };
      }

      // Validate and normalize the response
      const parseResult: Orea124ParseResult = {
        success: true,
        documentDate: geminiData.document_date || undefined,
        fulfilledConditions: this.normalizeFulfilledConditions(
          geminiData.fulfilled_conditions || []
        ),
      };

      console.log(
        `✅ OREA 124 parsing complete: ${parseResult.fulfilledConditions.length} condition(s) fulfilled`
      );

      return parseResult;
    } catch (error) {
      console.error("❌ OREA 124 parsing failed:", error);
      return {
        success: false,
        fulfilledConditions: [],
        errors: [error.message],
      };
    }
  }

  /**
   * Get the Gemini schema definition for OREA 124
   */
  private getOrea124Schema(): any {
    return {
      document_date: "string (ISO date format YYYY-MM-DD, optional)",
      fulfilled_conditions: [
        {
          description: "string",
          note: "string (optional)",
        },
      ],
    };
  }

  /**
   * Normalize fulfilled conditions from Gemini extraction
   */
  private normalizeFulfilledConditions(
    rawConditions: any[]
  ): Array<{ description: string; note?: string }> {
    if (!Array.isArray(rawConditions)) {
      return [];
    }

    return rawConditions
      .filter((c) => c.description && c.description.trim().length > 0)
      .map((condition) => ({
        description: condition.description.trim(),
        note: condition.note?.trim() || undefined,
      }));
  }
}
