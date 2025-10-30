import { Module } from '@nestjs/common';
import { AgreementsController } from './agreements.controller';
import { AgreementsWebhookController } from './agreements-webhook.controller';
import { AgreementsService } from './agreements.service';
import { PdfService } from './pdf.service';
import { DropboxSignService } from './dropbox-sign.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseService } from '../../common/supabase/supabase.service';

@Module({
  controllers: [AgreementsController, AgreementsWebhookController],
  providers: [
    AgreementsService,
    PdfService,
    DropboxSignService,
    PrismaService,
    SupabaseService,
  ],
  exports: [AgreementsService],
})
export class AgreementsModule {}

