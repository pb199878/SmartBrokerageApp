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

