import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { SupabaseModule } from '../../common/supabase/supabase.module';
import { ApsParserModule } from '../aps-parser/aps-parser.module';

@Module({
  imports: [PrismaModule, SupabaseModule, ApsParserModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService], // Export so other modules can use it
})
export class DocumentsModule {}

