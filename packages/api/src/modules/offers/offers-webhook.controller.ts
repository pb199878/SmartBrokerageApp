import { Controller, Post, Body } from '@nestjs/common';
import { OffersService } from './offers.service';

@Controller('webhooks')
export class OffersWebhookController {
  constructor(private readonly offersService: OffersService) {}

  /**
   * Dropbox Sign webhook endpoint
   * Receives signature events and processes them
   * POST /webhooks/hellosign
   * 
   * IMPORTANT: Dropbox Sign sends webhooks as application/x-www-form-urlencoded
   * with the event data in a 'json' field (as a stringified JSON object)
   */
  @Post('hellosign')
  async handleHelloSignWebhook(@Body() body: any) {
    console.log('📝 Received Dropbox Sign webhook');
    console.log('Raw body keys:', Object.keys(body));
    
    // Dropbox Sign sends event data in the 'json' field as a stringified JSON
    let payload: any;
    if (body.json) {
      try {
        payload = typeof body.json === 'string' ? JSON.parse(body.json) : body.json;
      } catch (error) {
        console.error('❌ Failed to parse Dropbox Sign webhook JSON:', error);
        return { success: false, error: 'Invalid JSON payload' };
      }
    } else {
      // Fallback: if body is already the event object
      payload = body;
    }
    
    console.log('Parsed payload:', JSON.stringify(payload, null, 2));
    
    await this.offersService.handleWebhook(payload);
    return { success: true };
  }
}

