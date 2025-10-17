import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';

@Injectable()
export class MailgunService {
  private apiKey: string;
  private domain: string;
  private webhookSigningKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('MAILGUN_API_KEY') || 'stubbed-key';
    this.domain = this.configService.get<string>('MAILGUN_DOMAIN') || 'inbox.yourapp.ca';
    this.webhookSigningKey = this.configService.get<string>('MAILGUN_WEBHOOK_SIGNING_KEY') || 'stubbed-signing-key';
    
    console.log('📦 Mailgun Service initialized (STUBBED - set up when ready)');
  }

  /**
   * Verify webhook signature from Mailgun
   * Ensures the request is actually from Mailgun
   */
  verifyWebhookSignature(timestamp: string, token: string, signature: string): boolean {
    // TODO: Implement when Mailgun is set up
    const encodedToken = crypto
      .createHmac('sha256', this.webhookSigningKey)
      .update(timestamp.concat(token))
      .digest('hex');
    
    return encodedToken === signature;
    
    // console.log('[STUB] Verifying Mailgun webhook signature');
    // return true; // Accept all for local dev
  }

  /**
   * Send email via Mailgun
   * @param from - From address (e.g., l-abc123@inbox.yourapp.ca)
   * @param to - Recipient email
   * @param subject - Email subject
   * @param text - Plain text body
   * @param html - HTML body (optional)
   */
  async sendEmail(
    from: string,
    to: string,
    subject: string,
    text: string,
    html?: string,
    inReplyTo?: string,
    references?: string,
    messageId?: string,
  ): Promise<void> {
    // TODO: Implement when Mailgun is set up
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({ username: 'api', key: this.apiKey });

    const messageData: any = {
      from,
      to,
      subject,
      text,
      html,
    };

    // Add threading headers if this is a reply
    if (inReplyTo) {
      messageData['h:In-Reply-To'] = inReplyTo;
    }
    if (references) {
      messageData['h:References'] = references;
    }
    if (messageId) {
      messageData['h:Message-Id'] = messageId;
    }
    
    await mg.messages.create(this.domain, messageData);
    
    // console.log(`[STUB] Sending email from ${from} to ${to}`);
    // console.log(`Subject: ${subject}`);
    // console.log(`Body: ${text.substring(0, 100)}...`);
  }

  /**
   * Parse incoming email from Mailgun webhook
   * Extracts important fields
   */
  parseIncomingEmail(payload: any) {
    const eventData = payload;
    
    // Use 'stripped-text' which removes quoted replies automatically
    // Falls back to 'body-plain' if stripped-text is not available
    const bodyText = eventData['stripped-text'] || eventData['body-plain'];
    
    return {
      from: eventData.sender,
      to: eventData.recipient,
      subject: eventData.subject,
      bodyText: bodyText,
      messageId: eventData['Message-Id'],
      inReplyTo: eventData['In-Reply-To'] || null,
      references: eventData['References'] || null,
      timestamp: new Date(eventData.timestamp * 1000),
      attachments: eventData.attachments || [],
    };
  }
}

