import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { AgreementsService } from './agreements.service';

@Controller('agreements/webhooks')
export class AgreementsWebhookController {
  private readonly logger = new Logger(AgreementsWebhookController.name);

  constructor(private readonly agreementsService: AgreementsService) {}

  /**
   * POST /agreements/webhooks/dropbox-sign
   * Handle Dropbox Sign webhook events
   */
  @Post('dropbox-sign')
  @HttpCode(200)
  async handleDropboxSignWebhook(@Body() event: any): Promise<{ success: boolean }> {
    try {
      this.logger.log(`Received Dropbox Sign webhook: ${event.event?.event_type}`);
      
      // TODO: Verify webhook signature for security
      // await this.dropboxSign.verifyWebhookSignature(...)

      await this.agreementsService.handleDropboxSignWebhook(event);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error handling Dropbox Sign webhook: ${error.message}`);
      // Return success anyway to avoid webhook retries
      return { success: true };
    }
  }
}

