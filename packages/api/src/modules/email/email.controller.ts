import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('webhooks')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * Mailgun webhook endpoint
   * Receives inbound emails and processes them
   */
  @Post('mailgun')
  async handleMailgunWebhook(@Body() payload: any) {
    console.log('📧 Received Mailgun webhook');
    return this.emailService.processInboundEmail(payload);
  }
}

