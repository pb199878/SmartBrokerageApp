import { Injectable, OnModuleInit } from "@nestjs/common";
import { fromBuffer } from "pdf2pic";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { execSync } from "child_process";

const unlinkAsync = promisify(fs.unlink);

export interface PdfPageImage {
  pageNumber: number;
  base64: string;
  width: number;
  height: number;
}

@Injectable()
export class PdfToImageService implements OnModuleInit {
  private graphicsMagickInstalled = false;

  /**
   * Check if GraphicsMagick is installed on module initialization
   */
  onModuleInit() {
    try {
      execSync("gm version", { stdio: "ignore" });
      this.graphicsMagickInstalled = true;
      console.log("✅ GraphicsMagick detected for PDF to image conversion");
    } catch (error) {
      this.graphicsMagickInstalled = false;
      console.warn(
        "⚠️  GraphicsMagick not found. Image-based validation will be disabled."
      );
      console.warn("   Install it with: brew install graphicsmagick");
    }
  }
  /**
   * Convert PDF buffer to images (one per page)
   * Returns array of base64-encoded PNG images
   */
  async convertPdfToImages(
    pdfBuffer: Buffer,
    options: {
      maxPages?: number; // Limit to first N pages (to save costs)
      quality?: number; // Image quality (1-100, default 90)
      format?: "png" | "jpeg"; // Image format
    } = {}
  ): Promise<PdfPageImage[]> {
    const { maxPages = 20, quality = 90, format = "png" } = options;

    // Check if GraphicsMagick is installed
    if (!this.graphicsMagickInstalled) {
      throw new Error(
        "GraphicsMagick is not installed. Please install it with: brew install graphicsmagick"
      );
    }

    console.log(
      `🖼️  Converting PDF to images (max ${maxPages} pages, quality: ${quality})`
    );

    try {
      const converter = fromBuffer(pdfBuffer, {
        density: 200, // DPI (higher = better quality but larger files)
        saveFilename: `temp_${Date.now()}`,
        savePath: "/tmp",
        format,
        width: 1700, // Width in pixels (letter size at 200dpi ≈ 1700px)
        height: 2200, // Height in pixels
        quality,
      });

      const images: PdfPageImage[] = [];
      const tempFiles: string[] = [];

      // Convert each page
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const result = await converter(pageNum, { responseType: "image" });

          if (!result?.path) {
            console.log(
              `⏭️  No more pages to convert (stopped at page ${pageNum})`
            );
            break;
          }

          // Read the temporary file
          const imageBuffer = fs.readFileSync(result.path);
          const base64 = imageBuffer.toString("base64");

          images.push({
            pageNumber: pageNum,
            base64,
            // Width/height not present on WriteImageResponse type, so use defaults
            width: 1700,
            height: 2200,
          });
          tempFiles.push(result.path);

          console.log(
            `✅ Converted page ${pageNum} (${(base64.length / 1024).toFixed(
              1
            )} KB)`
          );
        } catch (pageError: any) {
          console.log(
            `⏭️  Stopped at page ${pageNum} (likely end of document):`,
            pageError.message
          );
          break;
        }
      }

      // Clean up temporary files
      for (const filePath of tempFiles) {
        try {
          await unlinkAsync(filePath);
        } catch (err) {
          console.warn(`⚠️  Failed to delete temp file ${filePath}`);
        }
      }

      console.log(`✅ Converted ${images.length} pages to images`);

      return images;
    } catch (error: any) {
      console.error("❌ Failed to convert PDF to images:", error);
      throw new Error(`PDF to image conversion failed: ${error.message}`);
    }
  }

  /**
   * Convert only specific pages to images (useful for signature pages)
   */
  async convertSpecificPages(
    pdfBuffer: Buffer,
    pageNumbers: number[],
    options: {
      quality?: number;
      format?: "png" | "jpeg";
    } = {}
  ): Promise<PdfPageImage[]> {
    const { quality = 90, format = "png" } = options;

    // Check if GraphicsMagick is installed
    if (!this.graphicsMagickInstalled) {
      throw new Error(
        "GraphicsMagick is not installed. Please install it with: brew install graphicsmagick"
      );
    }

    console.log(
      `🖼️  Converting specific pages: ${pageNumbers.join(
        ", "
      )} (quality: ${quality})`
    );

    try {
      const converter = fromBuffer(pdfBuffer, {
        density: 200,
        saveFilename: `temp_${Date.now()}`,
        savePath: "/tmp",
        format,
        width: 1700,
        height: 2200,
        quality,
      });

      const images: PdfPageImage[] = [];
      const tempFiles: string[] = [];

      for (const pageNum of pageNumbers) {
        try {
          const result = await converter(pageNum, { responseType: "image" });

          if (!result?.path) {
            console.log(`⚠️  Could not convert page ${pageNum}`);
            continue;
          }

          const imageBuffer = fs.readFileSync(result.path);
          const base64 = imageBuffer.toString("base64");

          images.push({
            pageNumber: pageNum,
            base64,
            width: 1700,
            height: 2200,
          });

          tempFiles.push(result.path);

          console.log(
            `✅ Converted page ${pageNum} (${(base64.length / 1024).toFixed(
              1
            )} KB)`
          );
        } catch (pageError: any) {
          console.error(
            `❌ Failed to convert page ${pageNum}:`,
            pageError.message
          );
        }
      }

      // Clean up temporary files
      for (const filePath of tempFiles) {
        try {
          await unlinkAsync(filePath);
        } catch (err) {
          console.warn(`⚠️  Failed to delete temp file ${filePath}`);
        }
      }

      return images;
    } catch (error: any) {
      console.error("❌ Failed to convert specific pages:", error);
      throw new Error(`PDF page conversion failed: ${error.message}`);
    }
  }
}
