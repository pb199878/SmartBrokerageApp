import { Module } from "@nestjs/common";
import { AgreementsController } from "./agreements.controller";
import { AgreementsWebhookController } from "./agreements-webhook.controller";
import { AgreementsService } from "./agreements.service";
import { PdfService } from "./pdf.service";
import { DropboxSignModule } from "../../common/dropbox-sign/dropbox-sign.module";
import { PrismaService } from "../../common/prisma/prisma.service";
import { SupabaseService } from "../../common/supabase/supabase.service";

@Module({
  imports: [DropboxSignModule],
  controllers: [AgreementsController, AgreementsWebhookController],
  providers: [AgreementsService, PdfService, PrismaService, SupabaseService],
  exports: [AgreementsService],
})
export class AgreementsModule {}
