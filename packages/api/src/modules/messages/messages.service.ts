import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailgunService } from '../../common/mailgun/mailgun.service';
import { SendMessageDto, Message, MessageDirection, MessageStatus } from '@smart-brokerage/shared';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private mailgunService: MailgunService,
  ) {}

  async sendMessage(dto: SendMessageDto): Promise<Message> {
    // 1. Get thread to find listing and sender info
    const thread = await this.prisma.thread.findUnique({
      where: { id: dto.threadId },
      include: { listing: true, sender: true },
    });

    if (!thread) {
      throw new Error(`Thread ${dto.threadId} not found`);
    }

     // 2. Generate a unique Message-ID for this outgoing email
     const domain = process.env.MAILGUN_DOMAIN || '';
     if (!domain) {
      console.warn('⚠️  MAILGUN_DOMAIN is not set. Check your .env file.');
     }
     const messageId = this.generateMessageId(domain);
     console.log('📧 Generated Message-ID:', messageId);
 
     // 3. Build full References chain from all messages in thread
     const threadMessages = await this.prisma.message.findMany({
       where: { threadId: dto.threadId },
       select: { messageId: true },
       orderBy: { createdAt: 'asc' },
     });
 
     const referencesChain = threadMessages
       .map(m => m.messageId)
       .filter(Boolean)
       .join(' ');
 
     console.log('📎 References chain:', referencesChain);

    // 4. Create message in DB with PENDING status
    const message = await this.prisma.message.create({
      data: {
        threadId: dto.threadId,
        senderId: null, // Seller is sending
        senderEmail: `${thread.listing.emailAlias}@${domain}`,
        senderName: 'Seller',
        direction: MessageDirection.OUTBOUND,
        subject: `Re: ${thread.subject}`,
        bodyText: dto.text,
        messageId: messageId,
        status: MessageStatus.PENDING,
      },
    });

    // 5. Send email via Mailgun and update status
    try {
      await this.mailgunService.sendEmail(
        `${thread.listing.emailAlias}@${domain}`,
        thread.sender.email,
        `Re: ${thread.subject}`,
        dto.text,
        undefined,
        thread.emailThreadId,
        referencesChain,
        messageId, 
      );
      console.log(`✅ Sent threaded reply to ${thread.sender.email}`);
      
      // Update status to SENT on success and update thread lastMessageAt
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: MessageStatus.SENT },
      });
      
      await this.prisma.thread.update({
        where: { id: dto.threadId },
        data: { lastMessageAt: new Date() },
      });
      
      return { ...message, status: MessageStatus.SENT } as Message;
    } catch (error) {
      console.error('Failed to send email via Mailgun:', error);
      
      // Update status to FAILED on error
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: MessageStatus.FAILED },
      });
      
      // Return message with FAILED status so user can see it
      return { ...message, status: MessageStatus.FAILED } as Message;
    }

  }

  private generateMessageId(domain: string = "myapp.ca"): string {
    // Unix timestamp in ms
    const timestamp = Date.now();
  
    // 10-char random string (base36 for compactness)
    const randomPart = Math.random().toString(36).slice(2, 12);
  
    // Build RFC-compliant Message-ID
    return `<${timestamp}.${randomPart}@${domain}>`;
  }
}

