import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { ApsParserService } from '../aps-parser/aps-parser.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly apsParserService: ApsParserService
  ) {}

  /**
   * Test endpoint to parse an OREA PDF directly
   * POST /documents/test-parse
   * Upload a PDF file and get back the parsed result
   */
  @Post('test-parse')
  @UseInterceptors(FileInterceptor('pdf'))
  async testParse(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No PDF file uploaded');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('File must be a PDF');
    }

    console.log(`📄 Testing APS parser with: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);

    try {
      const result = await this.apsParserService.parseAps(file.buffer);
      
      return {
        success: true,
        data: result,
        meta: {
          filename: file.originalname,
          fileSize: file.size,
          parseDuration: 'See server logs',
        },
      };
    } catch (error) {
      console.error('❌ Parse failed:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Test endpoint to check buyer initials only
   * POST /documents/test-initials
   * Upload a PDF and get detailed initials check for each page
   */
  @Post('test-initials')
  @UseInterceptors(FileInterceptor('pdf'))
  async testInitials(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No PDF file uploaded');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('File must be a PDF');
    }

    console.log(
      `📄 Testing initials check with: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`
    );

    try {
      // Import services we need
      const PdfToImageService = require('../aps-parser/pdf-to-image.service')
        .PdfToImageService;
      const SignatureDetectorService = require('../aps-parser/signature-detector.service')
        .SignatureDetectorService;

      const pdfToImageService = new PdfToImageService();
      const signatureDetectorService = new SignatureDetectorService();

      // Initialize services
      pdfToImageService.onModuleInit();

      // Convert PDF to images
      const images = await pdfToImageService.convertPdfToImages(file.buffer, {
        maxPages: 15,
        quality: 85,
      });

      console.log(`📄 Converted ${images.length} pages to images`);

      // Check buyer initials
      const result = await signatureDetectorService.checkBuyerInitials(images);

      return {
        success: true,
        filename: file.originalname,
        result,
        details: result.pageResults.map((pr) => ({
          page: pr.pageNumber,
          found: pr.hasInitials ? '✅' : '❌',
          confidence: `${(pr.confidence * 100).toFixed(0)}%`,
          location: pr.location,
        })),
      };
    } catch (error) {
      console.error('❌ Initials check failed:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Test endpoint for full attachment analysis
   * POST /documents/test-analyze-attachment/:attachmentId
   * Analyzes an existing attachment by ID (must be in database)
   */
  @Post('test-analyze-attachment/:attachmentId')
  async testAnalyzeAttachment(@Param('attachmentId') attachmentId: string) {
    console.log(`🧪 Testing attachment analysis for: ${attachmentId}`);

    try {
      const result = await this.documentsService.analyzeAttachment(attachmentId);
      
      return {
        success: true,
        data: result,
        message: 'Attachment analyzed successfully',
      };
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }
}

