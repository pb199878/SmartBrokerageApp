import { Controller, Post, Body } from '@nestjs/common';
import { OffersService } from './offers.service';

@Controller('webhooks')
export class OffersWebhookController {
  constructor(private readonly offersService: OffersService) {}

  /**
   * Dropbox Sign webhook endpoint
   * Receives signature events and processes them
   * POST /webhooks/hellosign
   */
  @Post('hellosign')
  async handleHelloSignWebhook(@Body() payload: any) {
    console.log('📝 Received Dropbox Sign webhook');
    await this.offersService.handleWebhook(payload);
    return { success: true };
  }
}

