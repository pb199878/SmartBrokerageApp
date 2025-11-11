import { Module } from '@nestjs/common';
import { ApsParserService } from './aps-parser.service';
import { PdfToImageService } from './pdf-to-image.service';
import { SignatureDetectorService } from './signature-detector.service';

@Module({
  providers: [ApsParserService, PdfToImageService, SignatureDetectorService],
  exports: [ApsParserService, PdfToImageService, SignatureDetectorService],
})
export class ApsParserModule {}

