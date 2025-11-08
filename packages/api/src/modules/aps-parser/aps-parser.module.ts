import { Module } from '@nestjs/common';
import { ApsParserService } from './aps-parser.service';

@Module({
  providers: [ApsParserService],
  exports: [ApsParserService],
})
export class ApsParserModule {}

