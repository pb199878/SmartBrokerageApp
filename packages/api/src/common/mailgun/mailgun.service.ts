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
    this.apiKey = this.configService.get<string>('MAILGUN_API_KEY') || '';
    this.domain = this.configService.get<string>('MAILGUN_DOMAIN') || '';
    this.webhookSigningKey = this.configService.get<string>('MAILGUN_WEBHOOK_SIGNING_KEY') || '';
    
    if (!this.apiKey || !this.domain || !this.webhookSigningKey) {
      console.warn('⚠️  Mailgun credentials not configured. Check your .env file.');
      console.warn('   Copy env.example to .env and add your Mailgun credentials.');
    } else {
      console.log('📦 Mailgun Service initialized');
    }
  }

  /**
   * Verify webhook signature from Mailgun
   * Ensures the request is actually from Mailgun
   */
  verifyWebhookSignature(timestamp: string, token: string, signature: string): boolean {
    const encodedToken = crypto
      .createHmac('sha256', this.webhookSigningKey)
      .update(timestamp.concat(token))
      .digest('hex');
    
    return encodedToken === signature;
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
    
    // Parse attachments - Mailgun can send in different formats
    let attachments = [];
    
    if (eventData.attachments) {
      try {
        // Mailgun sends attachments as a JSON string
        attachments = typeof eventData.attachments === 'string' 
          ? JSON.parse(eventData.attachments)
          : eventData.attachments;
        console.log(`📎 Parsed ${attachments.length} attachment(s) from attachments field`);
      } catch (error) {
        console.error('Failed to parse attachments:', error);
        console.log('Raw attachments field:', eventData.attachments);
      }
    } 
    
    // If no attachments field but attachment-count > 0, check for content-id-map
    // This happens when using "store and notify" - attachments are in the stored message
    if (attachments.length === 0 && eventData['attachment-count']) {
      const count = parseInt(eventData['attachment-count']);
      if (count > 0) {
        console.log(`📎 Email has ${count} attachment(s) but no attachments field`);
        console.log('⚠️  Attachments are stored but not parsed in webhook payload');
        console.log('💡 Checking for content-id-map or attachment-x fields...');
        
        // Try to find attachment-x fields (Mailgun sometimes uses this format)
        for (let i = 1; i <= count; i++) {
          const attachmentKey = `attachment-${i}`;
          if (eventData[attachmentKey]) {
            console.log(`Found ${attachmentKey}:`, eventData[attachmentKey]);
            // This is typically a file object from multer when using multipart
            attachments.push(eventData[attachmentKey]);
          }
        }
        
        if (attachments.length === 0) {
          console.warn('⚠️  Could not extract attachment data from payload');
          console.warn('This typically means attachments are in multipart form fields');
          console.warn('Available payload keys:', Object.keys(eventData).filter(k => k.includes('attach') || k.includes('content')));
        }
      }
    }
    
    // Handle timestamp - might be string or number
    let timestamp = new Date();
    if (eventData.timestamp) {
      timestamp = new Date(
        typeof eventData.timestamp === 'string' 
          ? parseInt(eventData.timestamp) * 1000 
          : eventData.timestamp * 1000
      );
    } else if (eventData.Date) {
      timestamp = new Date(eventData.Date);
    }
    
    return {
      from: eventData.sender,
      to: eventData.recipient,
      subject: eventData.subject,
      bodyText: bodyText,
      bodyHtml: eventData['stripped-html'] || eventData['body-html'],
      messageId: eventData['Message-Id'],
      inReplyTo: eventData['In-Reply-To'] || null,
      references: eventData['References'] || null,
      timestamp: timestamp,
      attachments: attachments,
      attachmentCount: eventData['attachment-count'] ? parseInt(eventData['attachment-count']) : 0,
    };
  }
}

