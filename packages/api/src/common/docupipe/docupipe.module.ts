import { Module } from '@nestjs/common';
import { DocuPipeService } from './docupipe.service';

@Module({
  providers: [DocuPipeService],
  exports: [DocuPipeService],
})
export class DocuPipeModule {}

