import { Module } from "@nestjs/common";
import { OffersController } from "./offers.controller";
import { OffersWebhookController } from "./offers-webhook.controller";
import { OffersService } from "./offers.service";
import { PdfService } from "./pdf.service";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { DropboxSignModule } from "../../common/dropbox-sign/dropbox-sign.module";
import { SupabaseModule } from "../../common/supabase/supabase.module";
import { MailgunModule } from "../../common/mailgun/mailgun.module";

@Module({
  imports: [PrismaModule, DropboxSignModule, SupabaseModule, MailgunModule],
  controllers: [OffersController, OffersWebhookController],
  providers: [OffersService, PdfService],
  exports: [OffersService], // Export so other modules can use it
})
export class OffersModule {}
