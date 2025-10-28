import { Controller, Post, Body, Req, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { EmailService } from './email.service';

@Controller('webhooks')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * Mailgun webhook endpoint
   * Receives inbound emails and processes them
   * 
   * Uses AnyFilesInterceptor to handle multipart/form-data from Mailgun
   * Mailgun sends webhooks as multipart when attachments are present
   */
  @Post('mailgun')
  @UseInterceptors(AnyFilesInterceptor())
  async handleMailgunWebhook(@Req() req: Request, @Body() payload: any) {
    console.log('📧 Received Mailgun webhook');
    console.log('📦 Content-Type:', req.headers['content-type']);
    console.log('📦 Payload keys:', payload ? Object.keys(payload) : 'EMPTY');
    
    // Check for files uploaded via multipart (handled by multer)
    const files = (req as any).files;
    if (files && files.length > 0) {
      console.log(`📎 Multer intercepted ${files.length} file(s):`);
      files.forEach((file: any, index: number) => {
        console.log(`  File ${index + 1}: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
      });
      
      // Add files to payload so the email service can process them
      payload._uploadedFiles = files;
    }
    
    // Debug: Check if payload is empty
    if (!payload || Object.keys(payload).length === 0) {
      console.error('❌ Empty payload received!');
      console.error('Headers:', req.headers);
      console.error('Body:', req.body);
      return { error: 'Empty payload' };
    }
    
    return this.emailService.processInboundEmail(payload);
  }
}

