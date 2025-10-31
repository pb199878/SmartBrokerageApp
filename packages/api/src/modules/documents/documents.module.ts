import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { SupabaseModule } from '../../common/supabase/supabase.module';
import { DocuPipeModule } from '../../common/docupipe/docupipe.module';

@Module({
  imports: [PrismaModule, SupabaseModule, DocuPipeModule],
  providers: [DocumentsService],
  exports: [DocumentsService], // Export so other modules can use it
})
export class DocumentsModule {}

