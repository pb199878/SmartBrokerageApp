import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailgunService } from '../../common/mailgun/mailgun.service';
import { SendMessageDto, Message, MessageDirection } from '@smart-brokerage/shared';

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

    // 2. Create message in DB
    const message = await this.prisma.message.create({
      data: {
        threadId: dto.threadId,
        senderId: null, // Seller is sending
        senderEmail: thread.listing.emailAlias,
        senderName: 'Seller',
        direction: MessageDirection.OUTBOUND,
        subject: `Re: ${thread.subject}`,
        bodyText: dto.text,
      },
    });

    // 3. Send email via Mailgun
    try {
      await this.mailgunService.sendEmail(
        `${thread.listing.emailAlias}`,
        thread.sender.email,
        `Re: ${thread.subject}`,
        dto.text,
        undefined,
        thread.emailThreadId,       // In-Reply-To: original Message-ID
        thread.emailThreadId, 
      );
      console.log(`✅ Sent threaded reply to ${thread.sender.email}`);
    } catch (error) {
      console.error('Failed to send email via Mailgun:', error);
      // Continue even if email fails - message is saved in DB
    }

    // 4. Update thread lastMessageAt
    await this.prisma.thread.update({
      where: { id: dto.threadId },
      data: { lastMessageAt: new Date() },
    });

    return message as Message;
  }
}

