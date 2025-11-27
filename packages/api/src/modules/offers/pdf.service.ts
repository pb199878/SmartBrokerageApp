import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  APS_2024_FIELD_COORDINATES,
  OREA_VERSION_FINGERPRINTS,
  FieldCoordinate,
  ApsIntake,
} from '@smart-brokerage/shared';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Detect OREA version from PDF content
   * @param pdfBytes - PDF file buffer
   * @returns Detected version string or null if not recognized
   */
  async detectOreaVersion(pdfBytes: Buffer): Promise<string | null> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();

      // Extract text from all pages to search for fingerprints
      let fullText = '';
      const pages = pdfDoc.getPages();
      
      // Simple text extraction (this is basic; for production consider using pdf-parse)
      // For now, we'll check the page count and assume structure
      
      // Check each version fingerprint
      for (const [version, fingerprint] of Object.entries(OREA_VERSION_FINGERPRINTS)) {
        if (fingerprint.pageCount === pageCount) {
          this.logger.log(`Detected OREA version: ${version} (page count: ${pageCount})`);
          return version;
        }
      }

      // If we can't detect by page count, try to extract and search text
      // This would require additional libraries like pdf-parse
      // For now, default to APS-2024 if page count is ~5
      if (pageCount >= 4 && pageCount <= 6) {
        this.logger.warn(`Could not definitively detect version, defaulting to APS-2024`);
        return 'APS-2024';
      }

      this.logger.warn(`Could not detect OREA version. Page count: ${pageCount}`);
      return null;
    } catch (error) {
      this.logger.error(`Error detecting OREA version: ${error.message}`);
      return null;
    }
  }

  /**
   * Flatten form fields in PDF (preserve buyer's filled data as static text)
   * @param pdfBytes - PDF file buffer
   * @returns Flattened PDF buffer
   */
  async flattenPdf(pdfBytes: Buffer): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();

      // Flatten all form fields (makes them read-only/static)
      form.flatten();

      const flattened = await pdfDoc.save();
      this.logger.log('PDF flattened successfully');
      return Buffer.from(flattened);
    } catch (error) {
      this.logger.error(`Error flattening PDF: ${error.message}`);
      throw error;
    }
  }

  /**
   * Prefill seller intake data onto the PDF
   * @param pdfBytes - PDF file buffer (should be flattened first)
   * @param intake - Seller's intake responses
   * @param version - OREA version (determines field coordinates)
   * @returns Modified PDF buffer with prefilled data
   */
  async prefillSellerData(
    pdfBytes: Buffer,
    intake: ApsIntake,
    version: string = 'APS-2024',
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Map intake fields to PDF coordinates
      const fieldMappings = this.buildFieldMappings(intake);

      for (const [fieldName, value] of Object.entries(fieldMappings)) {
        if (!value || value === '') continue;

        const coord = APS_2024_FIELD_COORDINATES[fieldName];
        if (!coord) {
          this.logger.warn(`No coordinate mapping for field: ${fieldName}`);
          continue;
        }

        await this.drawTextOnPdf(
          pdfDoc,
          value,
          coord,
          font,
        );
      }

      const modified = await pdfDoc.save();
      this.logger.log('Seller data prefilled successfully');
      return Buffer.from(modified);
    } catch (error) {
      this.logger.error(`Error prefilling seller data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Draw text on PDF at specified coordinates
   */
  private async drawTextOnPdf(
    pdfDoc: PDFDocument,
    text: string,
    coord: FieldCoordinate,
    font: any,
  ): Promise<void> {
    const pages = pdfDoc.getPages();
    const page = pages[coord.page];

    if (!page) {
      this.logger.warn(`Page ${coord.page} not found`);
      return;
    }

    const fontSize = coord.fontSize || 10;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const maxWidth = coord.width || 500;

    // Handle text that's too long by wrapping or truncating
    if (textWidth > maxWidth) {
      // For now, just log a warning. In production, implement text wrapping
      this.logger.warn(`Text too long for field: ${text.substring(0, 50)}...`);
    }

    page.drawText(text, {
      x: coord.x,
      y: coord.y,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
      maxWidth: maxWidth,
    });
  }

  /**
   * Build field mappings from intake data
   */
  private buildFieldMappings(intake: ApsIntake): Record<string, string> {
    const mappings: Record<string, string> = {};

    // Property Information
    if (intake.propertyAddress) mappings.propertyAddress = intake.propertyAddress;
    if (intake.legalDescription) mappings.legalDescription = intake.legalDescription;

    // Financial Terms
    if (intake.purchasePrice) mappings.purchasePrice = `$${intake.purchasePrice.toLocaleString()}`;
    if (intake.depositAmount) mappings.depositAmount = `$${intake.depositAmount.toLocaleString()}`;
    if (intake.depositDueDate) mappings.depositDueDate = this.formatDate(intake.depositDueDate);

    // Dates
    if (intake.completionDate) mappings.completionDate = this.formatDate(intake.completionDate);
    if (intake.possessionDate) mappings.possessionDate = this.formatDate(intake.possessionDate);

    // Inclusions/Exclusions
    if (intake.inclusions) mappings.inclusions = intake.inclusions;
    if (intake.exclusions) mappings.exclusions = intake.exclusions;
    if (intake.fixtures) mappings.fixtures = intake.fixtures;
    if (intake.chattels) mappings.chattels = intake.chattels;
    if (intake.rentalItems) mappings.rentalItems = intake.rentalItems;

    // Additional Terms
    if (intake.additionalTerms) mappings.additionalTerms = intake.additionalTerms;

    // Seller Information
    if (intake.sellerLegalName) mappings.sellerLegalName = intake.sellerLegalName;
    if (intake.sellerAddress) mappings.sellerAddress = intake.sellerAddress;
    if (intake.sellerPhone) mappings.sellerPhone = intake.sellerPhone;

    // Lawyer Information
    if (intake.lawyerName) mappings.lawyerName = intake.lawyerName;
    if (intake.lawyerFirm) mappings.lawyerFirm = intake.lawyerFirm;
    if (intake.lawyerAddress) mappings.lawyerAddress = intake.lawyerAddress;
    if (intake.lawyerPhone) mappings.lawyerPhone = intake.lawyerPhone;
    if (intake.lawyerEmail) mappings.lawyerEmail = intake.lawyerEmail;

    return mappings;
  }

  /**
   * Format date for PDF display
   * Parses YYYY-MM-DD strings without timezone conversion to avoid off-by-one day errors
   */
  private formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      // Parse YYYY-MM-DD format directly to avoid timezone conversion
      const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        // Return as-is if already in YYYY-MM-DD format
        return date.substring(0, 10);
      }
      // If not in YYYY-MM-DD format, try parsing and use UTC methods
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return date; // Return original if parsing fails
    } else {
      // For Date objects, use UTC methods to avoid timezone issues
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  /**
   * Download PDF from Supabase and return buffer
   * This is a helper that will be used with SupabaseService
   */
  async downloadPdfFromUrl(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(`Error downloading PDF: ${error.message}`);
      throw error;
    }
  }
}

