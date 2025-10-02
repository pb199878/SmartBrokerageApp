import { Injectable } from '@nestjs/common';
// import { Queue } from 'bullmq';
// import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailgunService } from '../../common/mailgun/mailgun.service';
import { SupabaseService } from '../../common/supabase/supabase.service';

@Injectable()
export class EmailService {
  constructor(
    // @InjectQueue('email-processing') private emailQueue: Queue, // TODO: Uncomment when BullMQ is set up
    private prisma: PrismaService,
    private mailgunService: MailgunService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Process inbound email from Mailgun webhook
   * This will be the main entry point for incoming emails
   */
  async processInboundEmail(payload: any) {
    console.log('📧 Processing inbound email...');

    // 1. Verify webhook signature
    const { signature } = payload;
    const isValid = this.mailgunService.verifyWebhookSignature(
      signature.timestamp,
      signature.token,
      signature.signature,
    );

    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return { error: 'Invalid signature' };
    }

    // 2. Parse email
    const email = this.mailgunService.parseIncomingEmail(payload);
    console.log(`From: ${email.from}`);
    console.log(`To: ${email.to}`);
    console.log(`Subject: ${email.subject}`);

    // TODO: When BullMQ is set up, enqueue job instead of processing directly
    // await this.emailQueue.add('process-email', { email, payload });
    
    // For now, process directly (stubbed)
    await this.processEmailDirectly(email);

    return { success: true, message: 'Email received' };
  }

  /**
   * Process email directly (used when queue is not available)
   * TODO: Move to EmailProcessor when BullMQ is set up
   */
  private async processEmailDirectly(email: any) {
    // 1. Extract listing ID from email alias
    // Example: l-abc123@inbox.yourapp.ca -> abc123
    const listingAlias = email.to.split('@')[0]; // e.g., "l-abc123"
    console.log(`Listing alias: ${listingAlias}`);

    // 2. Find or create sender
    // TODO: Implement when DB is connected
    // const sender = await this.prisma.sender.upsert({
    //   where: { email: email.from },
    //   update: {},
    //   create: {
    //     email: email.from,
    //     name: this.extractNameFromEmail(email.from),
    //     domain: this.extractDomain(email.from),
    //   },
    // });

    // 3. Find or create thread
    // TODO: Implement when DB is connected
    // const thread = await this.prisma.thread.upsert({
    //   where: { listingId_senderId_subject },
    //   update: { lastMessageAt: new Date() },
    //   create: {
    //     listingId,
    //     senderId: sender.id,
    //     subject: email.subject,
    //     category: this.classifyMessage(email.subject, email.bodyText),
    //   },
    // });

    // 4. Store message
    // TODO: Implement when DB is connected
    // await this.prisma.message.create({
    //   data: {
    //     threadId: thread.id,
    //     senderId: sender.id,
    //     senderEmail: email.from,
    //     senderName: sender.name,
    //     direction: 'INBOUND',
    //     subject: email.subject,
    //     bodyText: email.bodyText,
    //     bodyHtml: email.bodyHtml,
    //   },
    // });

    // 5. Upload to Supabase Storage
    // TODO: Implement when Supabase is set up
    // await this.supabaseService.uploadFile(
    //   'emails',
    //   `${listingId}/${messageId}.eml`,
    //   rawEmailBuffer,
    //   'message/rfc822',
    // );

    // 6. Handle attachments
    // TODO: Implement attachment upload

    // 7. Send push notification
    // TODO: Implement when Expo Push is set up

    console.log('[STUB] Email processed successfully');
  }

  /**
   * Classify message based on content
   */
  private classifyMessage(subject: string, body: string): string {
    const combined = `${subject} ${body}`.toLowerCase();
    
    if (combined.includes('offer') || combined.includes('aps')) {
      return 'OFFER';
    }
    if (combined.includes('showing') || combined.includes('view') || combined.includes('visit')) {
      return 'SHOWING';
    }
    return 'GENERAL';
  }

  private extractNameFromEmail(email: string): string {
    // Extract name from "John Smith <john@example.com>" format
    const match = email.match(/^(.+?)\s*<.*>$/);
    return match ? match[1].trim() : email.split('@')[0];
  }

  private extractDomain(email: string): string {
    return email.split('@')[1] || '';
  }
}

