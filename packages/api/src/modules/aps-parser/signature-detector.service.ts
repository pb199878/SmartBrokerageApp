import { Injectable } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PdfPageImage } from "./pdf-to-image.service";

export interface SignatureDetectionResult {
  hasSignatures: boolean;
  signatureCount: number;
  signatureLocations: SignatureLocation[];
  confidence: number;
  additionalNotes?: string;
}

export interface SignatureLocation {
  pageNumber: number;
  signatureType:
    | "buyer_signature"
    | "seller_signature"
    | "witness_signature"
    | "agent_signature"
    | "unknown";
  confidence: number;
  location?: string; // e.g., "bottom right", "middle of page"
}

export interface VisualValidationResult {
  signatureDetection: SignatureDetectionResult;
  checkboxesDetected: {
    field: string;
    checked: boolean;
    confidence: number;
  }[];
  visualQuality: {
    isReadable: boolean;
    hasBlurredSections: boolean;
    overallQuality: number; // 0-1
  };
  crossValidation: {
    textMatchesVisual: boolean;
    discrepancies: string[];
  };
}

@Injectable()
export class SignatureDetectorService {
  private genAI: GoogleGenerativeAI | null = null;
  private geminiEnabled: boolean = false;

  constructor() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.geminiEnabled = true;
      console.log("✅ Gemini Vision initialized for signature detection");
    } else {
      console.log(
        "⚠️  Gemini Vision not configured (GOOGLE_GEMINI_API_KEY missing)"
      );
    }
  }

  /**
   * Detect signatures in PDF page images using Gemini Vision
   */
  async detectSignatures(
    images: PdfPageImage[]
  ): Promise<SignatureDetectionResult> {
    if (!this.geminiEnabled) {
      throw new Error(
        "Gemini Vision not configured. Please set GOOGLE_GEMINI_API_KEY"
      );
    }

    console.log(`🔍 Analyzing ${images.length} pages for signatures...`);

    try {
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
      });

      // Focus on signature-relevant pages (typically last 2-3 pages for OREA Form 100)
      const signaturePages = images.slice(-3); // Last 3 pages

      const prompt = `You are analyzing images of an OREA Form 100 (Agreement of Purchase and Sale) for signatures.

Please analyze each page and detect ALL signatures present. For each signature found, identify:
1. The page number
2. The type of signature (buyer, seller, witness, agent, or unknown)
3. The approximate location on the page (e.g., "bottom right", "middle left", "top section")
4. Your confidence level (0.0 to 1.0)

Return ONLY valid JSON in this exact format:
{
  "hasSignatures": true/false,
  "signatureCount": number,
  "signatureLocations": [
    {
      "pageNumber": number,
      "signatureType": "buyer_signature" | "seller_signature" | "witness_signature" | "agent_signature" | "unknown",
      "confidence": 0.0-1.0,
      "location": "description of location"
    }
  ],
  "confidence": 0.0-1.0,
  "additionalNotes": "any relevant observations"
}

CRITICAL RULES:
- Look for handwritten signatures (cursive writing, initials, or marks)
- Digital signatures may appear as text stamps or typed names
- Buyer signatures are typically in the "INITIALS" sections and final signature section
- Check for initials on each page (small signatures in margins)
- If no signatures are found, return hasSignatures: false with empty signatureLocations array
- Be conservative with confidence scores - only mark high confidence if clearly a signature`;

      // Build content parts with images
      const contentParts: any[] = [prompt];

      for (const img of signaturePages) {
        contentParts.push({
          inlineData: {
            mimeType: "image/png",
            data: img.base64,
          },
        });
      }

      console.log("🤖 Sending images to Gemini Vision for signature detection");
      const result = await model.generateContent(contentParts);
      const response = result.response;
      const text = response.text();

      console.log("📥 Received signature detection response");

      // Parse JSON response
      let signatureData: SignatureDetectionResult;
      try {
        const cleanedText = text
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        signatureData = JSON.parse(cleanedText);
      } catch (parseError: any) {
        console.error("❌ Failed to parse signature detection response:", text);
        throw new Error(
          "Gemini returned invalid JSON for signature detection: " +
            parseError.message
        );
      }

      console.log(
        `✅ Signature detection complete: ${signatureData.signatureCount} signature(s) found`
      );

      return signatureData;
    } catch (error: any) {
      console.error("❌ Signature detection failed:", error);
      throw error;
    }
  }

  /**
   * Perform comprehensive visual validation with focused buyer initials check
   * Checks for buyer initials on pages 1, 2, 3, 4, 6 (bottom right circular boxes)
   */
  async performVisualValidation(
    images: PdfPageImage[],
    extractedTextData?: any
  ): Promise<VisualValidationResult> {
    if (!this.geminiEnabled) {
      throw new Error(
        "Gemini Vision not configured. Please set GOOGLE_GEMINI_API_KEY"
      );
    }

    console.log(`🔍 Performing visual validation on ${images.length} pages...`);

    try {
      // Use focused buyer initials check for OREA forms
      const initialsCheck = await this.checkBuyerInitials(images);

      // Simple quality check on first page
      const firstPage = images[0];
      let visualQuality = {
        isReadable: true,
        hasBlurredSections: false,
        overallQuality: 0.9,
      };

      if (firstPage) {
        try {
          const model = this.genAI!.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
          });

          const qualityPrompt = `Analyze this PDF page image for quality. Return ONLY JSON:
{
  "isReadable": true/false,
  "hasBlurredSections": true/false,
  "overallQuality": 0.0-1.0
}`;

          const qualityResult = await model.generateContent([
            qualityPrompt,
            {
              inlineData: {
                mimeType: "image/png",
                data: firstPage.base64,
              },
            },
          ]);

          const qualityText = qualityResult.response.text();
          const cleanedQuality = qualityText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
          visualQuality = JSON.parse(cleanedQuality);
        } catch (error) {
          console.log("⚠️  Quality check failed, using defaults");
        }
      }

      // Build signature detection result from initials check
      const signatureDetection: SignatureDetectionResult = {
        hasSignatures: initialsCheck.allInitialsPresent,
        signatureCount: initialsCheck.totalInitialsFound,
        signatureLocations: initialsCheck.pageResults.map((pr) => ({
          pageNumber: pr.pageNumber,
          signatureType: "buyer_signature" as const,
          confidence: pr.confidence,
          location: pr.location || "bottom right",
        })),
        confidence:
          initialsCheck.totalInitialsFound > 0
            ? initialsCheck.pageResults
                .filter((r) => r.hasInitials)
                .reduce((sum, r) => sum + r.confidence, 0) /
              initialsCheck.totalInitialsFound
            : 0,
        additionalNotes: `Checked buyer initials on pages 1, 2, 3, 4, 6. Found ${initialsCheck.totalInitialsFound}/${initialsCheck.totalPagesChecked} pages with initials.`,
      };

      // Cross-validation with extracted text data
      const crossValidation = {
        textMatchesVisual: true,
        discrepancies: [] as string[],
      };

      if (extractedTextData) {
        // Check if extracted data has buyer info
        if (!extractedTextData.buyer_full_name) {
          crossValidation.textMatchesVisual = false;
          crossValidation.discrepancies.push(
            "No buyer name extracted from text"
          );
        }

        // Check if we found initials but no signatures detected in text
        if (
          initialsCheck.totalInitialsFound === 0 &&
          extractedTextData.buyer_full_name
        ) {
          crossValidation.textMatchesVisual = false;
          crossValidation.discrepancies.push(
            "Buyer name found in text but no initials detected visually"
          );
        }
      }

      const validationData: VisualValidationResult = {
        signatureDetection,
        checkboxesDetected: [], // Simplified - not checking checkboxes
        visualQuality,
        crossValidation,
      };

      console.log(
        `✅ Visual validation complete: ${initialsCheck.totalInitialsFound}/${initialsCheck.totalPagesChecked} initials found`
      );

      return validationData;
    } catch (error: any) {
      console.error("❌ Visual validation failed:", error);
      throw error;
    }
  }

  /**
   * Quick signature check (lightweight, only checks last page for buyer signatures)
   */
  async quickSignatureCheck(lastPageImage: PdfPageImage): Promise<boolean> {
    if (!this.geminiEnabled) {
      console.log("⚠️  Gemini Vision not available, skipping signature check");
      return false;
    }

    try {
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
      });

      const prompt = `Look at this image and answer YES or NO: Are there any handwritten signatures visible on this page? Just answer "YES" or "NO".`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "image/png",
            data: lastPageImage.base64,
          },
        },
      ]);

      const text = result.response.text().trim().toUpperCase();
      const hasSignature = text.includes("YES");

      console.log(`🔍 Quick signature check: ${hasSignature ? "YES" : "NO"}`);

      return hasSignature;
    } catch (error: any) {
      console.error("❌ Quick signature check failed:", error.message);
      return false;
    }
  }

  /**
   * Check for buyer initials on OREA form pages
   * Specifically looks for initials in boxes at BOTTOM CENTER of pages 1, 2, 3, 4, and 6
   * @param images - PDF page images (should be high quality, 200+ DPI)
   */
  async checkBuyerInitials(images: PdfPageImage[]): Promise<{
    allInitialsPresent: boolean;
    pageResults: {
      pageNumber: number;
      hasInitials: boolean;
      confidence: number;
      location?: string;
    }[];
    totalPagesChecked: number;
    totalInitialsFound: number;
  }> {
    if (!this.geminiEnabled) {
      throw new Error(
        "Gemini Vision not configured. Please set GOOGLE_GEMINI_API_KEY"
      );
    }

    console.log(
      `🔍 Checking buyer initials on OREA form pages 1, 2, 3, 4, 6...`
    );

    // Pages to check (1-indexed)
    const pagesToCheck = [1, 2, 3, 4, 6];
    const pageResults: {
      pageNumber: number;
      hasInitials: boolean;
      confidence: number;
      location?: string;
    }[] = [];

    try {
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
      });

      // Check each required page
      for (const pageNum of pagesToCheck) {
        const pageImage = images.find((img) => img.pageNumber === pageNum);

        if (!pageImage) {
          console.log(`⚠️  Page ${pageNum} not found in images`);
          pageResults.push({
            pageNumber: pageNum,
            hasInitials: false,
            confidence: 0,
          });
          continue;
        }

        const prompt = `Look at this image of page ${pageNum} from an OREA form.

Your ONLY task: Check if there is ANY handwriting or marking in the bottom center area of the page (in a box, circle, or anywhere near the bottom).

Scan the ENTIRE bottom third of the image. Look for:
- Any letters or scribbles in boxes
- Any handwritten marks
- Any typed/printed initials
- Even faint or messy marks count

Answer these questions:
1. Do you see ANY box, circle, or form field in the bottom area? (yes/no)
2. Is there ANY writing, marks, or letters inside or near those boxes? (yes/no)

If you answered YES to both questions, then hasInitials should be TRUE.

Return ONLY this JSON format:
{
  "hasInitials": true,
  "confidence": 0.9,
  "location": "describe what you see and exactly where"
}

OR if you see NO marks at all:
{
  "hasInitials": false,
  "confidence": 0.8,
  "location": "bottom area is empty, no marks found"
}

BE VERY GENEROUS - if you see ANY marks that could possibly be initials, mark it as true.`;

        console.log(`  Checking page ${pageNum}...`);
        console.log(
          `    Image size: ${(pageImage.base64.length / 1024).toFixed(1)} KB`
        );

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: "image/png",
              data: pageImage.base64,
            },
          },
        ]);

        const text = result.response.text();
        console.log(`    📝 Gemini response: ${text.substring(0, 150)}...`);

        // Parse JSON response
        let pageResult: {
          hasInitials: boolean;
          confidence: number;
          location?: string;
        };

        try {
          const cleanedText = text
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
          pageResult = JSON.parse(cleanedText);

          // Log the raw response for debugging
          console.log(`    Raw response: ${text.substring(0, 200)}...`);
        } catch (parseError) {
          console.error(`❌ Failed to parse response for page ${pageNum}:`);
          console.error(`   Raw text: ${text}`);
          pageResult = {
            hasInitials: false,
            confidence: 0,
            location: "Parse error - check logs",
          };
        }

        pageResults.push({
          pageNumber: pageNum,
          ...pageResult,
        });

        console.log(
          `  Page ${pageNum}: ${
            pageResult.hasInitials ? "✅" : "❌"
          } (confidence: ${(pageResult.confidence * 100).toFixed(0)}%)`
        );
      }

      const totalInitialsFound = pageResults.filter(
        (r) => r.hasInitials
      ).length;
      const allInitialsPresent = totalInitialsFound === pagesToCheck.length;

      console.log(
        `📝 Buyer initials check complete: ${totalInitialsFound}/${
          pagesToCheck.length
        } pages ${allInitialsPresent ? "✅" : "❌"}`
      );

      return {
        allInitialsPresent,
        pageResults,
        totalPagesChecked: pagesToCheck.length,
        totalInitialsFound,
      };
    } catch (error: any) {
      console.error("❌ Buyer initials check failed:", error);
      throw error;
    }
  }

  /**
   * Check for Confirmation of Acceptance signature on OREA Form 100
   * This is used when a buyer accepts a seller's counter-offer
   * The "CONFIRMATION OF ACCEPTANCE" section is on Page 5 (0-based index 4)
   * @param images - PDF page images (should be high quality, 200+ DPI)
   */
  async checkConfirmationOfAcceptance(images: PdfPageImage[]): Promise<{
    hasConfirmationSignature: boolean;
    confidence: number;
    details: {
      sellerSignaturePresent: boolean;
      buyerAcceptanceSignaturePresent: boolean;
      acceptanceDate?: string;
      location?: string;
    };
  }> {
    if (!this.geminiEnabled) {
      throw new Error(
        "Gemini Vision not configured. Please set GOOGLE_GEMINI_API_KEY"
      );
    }

    console.log(`🔍 Checking for Confirmation of Acceptance signature...`);

    try {
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
      });

      // Page 5 (0-based index 4) contains the Confirmation of Acceptance section
      const page5Image = images.find((img) => img.pageNumber === 5);

      if (!page5Image) {
        console.log(`⚠️  Page 5 not found in images`);
        return {
          hasConfirmationSignature: false,
          confidence: 0,
          details: {
            sellerSignaturePresent: false,
            buyerAcceptanceSignaturePresent: false,
          },
        };
      }

      const prompt = `Analyze this image of Page 5 from an OREA Form 100 (Agreement of Purchase and Sale).

Your task is to find the "CONFIRMATION OF ACCEPTANCE" section. This section is typically located in the lower portion of the page and contains:
1. A statement about the seller confirming acceptance
2. A signature line for the SELLER to confirm they received the buyer's acceptance
3. A signature line for the BUYER to confirm their acceptance of a counter-offer
4. A date field

Look specifically for:
- The heading "CONFIRMATION OF ACCEPTANCE" or similar text
- Handwritten signatures in the signature boxes/lines in this section
- Any dates written in this section

IMPORTANT: This is different from the main signature section. The Confirmation of Acceptance is used when:
- A seller made a counter-offer
- The buyer is now accepting that counter-offer
- Both parties sign in this specific section to confirm

Return ONLY valid JSON in this exact format:
{
  "hasConfirmationSignature": true/false,
  "confidence": 0.0-1.0,
  "details": {
    "sellerSignaturePresent": true/false,
    "buyerAcceptanceSignaturePresent": true/false,
    "acceptanceDate": "date if visible, or null",
    "location": "description of where signatures were found"
  }
}

Rules:
- Set hasConfirmationSignature to TRUE only if the BUYER'S acceptance signature is present
- The seller's signature being present is informational but not required for hasConfirmationSignature
- Be conservative - only mark as true if you clearly see a handwritten signature
- If the section exists but is empty, return hasConfirmationSignature: false`;

      console.log(`  Checking page 5 for Confirmation of Acceptance...`);
      console.log(
        `    Image size: ${(page5Image.base64.length / 1024).toFixed(1)} KB`
      );

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "image/png",
            data: page5Image.base64,
          },
        },
      ]);

      const text = result.response.text();
      console.log(`    📝 Gemini response: ${text.substring(0, 200)}...`);

      // Parse JSON response
      let parsedResult: {
        hasConfirmationSignature: boolean;
        confidence: number;
        details: {
          sellerSignaturePresent: boolean;
          buyerAcceptanceSignaturePresent: boolean;
          acceptanceDate?: string;
          location?: string;
        };
      };

      try {
        const cleanedText = text
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        parsedResult = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error(`❌ Failed to parse Confirmation of Acceptance response:`);
        console.error(`   Raw text: ${text}`);
        return {
          hasConfirmationSignature: false,
          confidence: 0,
          details: {
            sellerSignaturePresent: false,
            buyerAcceptanceSignaturePresent: false,
            location: "Parse error - check logs",
          },
        };
      }

      console.log(
        `✅ Confirmation of Acceptance check complete: ${
          parsedResult.hasConfirmationSignature ? "SIGNED" : "NOT SIGNED"
        } (confidence: ${(parsedResult.confidence * 100).toFixed(0)}%)`
      );

      return parsedResult;
    } catch (error: any) {
      console.error("❌ Confirmation of Acceptance check failed:", error);
      throw error;
    }
  }
}
