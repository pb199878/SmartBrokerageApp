import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { OffersWebhookController } from './offers-webhook.controller';
import { OffersService } from './offers.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { HelloSignModule } from '../../common/hellosign/hellosign.module';
import { SupabaseModule } from '../../common/supabase/supabase.module';
import { MailgunModule } from '../../common/mailgun/mailgun.module';

@Module({
  imports: [PrismaModule, HelloSignModule, SupabaseModule, MailgunModule],
  controllers: [OffersController, OffersWebhookController],
  providers: [OffersService],
  exports: [OffersService], // Export so other modules can use it
})
export class OffersModule {}

