import { Module } from '@nestjs/common';
import { ApsParserService } from './aps-parser.service';
import { PdfToImageService } from './pdf-to-image.service';
import { SignatureDetectorService } from './signature-detector.service';
import { Orea124ParserService } from './orea-124-parser.service';

@Module({
  providers: [ApsParserService, PdfToImageService, SignatureDetectorService, Orea124ParserService],
  exports: [ApsParserService, PdfToImageService, SignatureDetectorService, Orea124ParserService],
})
export class ApsParserModule {}

