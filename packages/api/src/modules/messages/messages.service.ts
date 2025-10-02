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
    // TODO: Implement when services are connected
    
    // 1. Get thread to find listing and sender info
    // const thread = await this.prisma.thread.findUnique({
    //   where: { id: dto.threadId },
    //   include: { listing: true, sender: true },
    // });

    // 2. Create message in DB
    // const message = await this.prisma.message.create({
    //   data: {
    //     threadId: dto.threadId,
    //     senderId: null, // Seller is sending
    //     senderEmail: thread.listing.emailAlias + '@inbox.yourapp.ca',
    //     senderName: 'Seller',
    //     direction: MessageDirection.OUTBOUND,
    //     subject: `Re: ${thread.subject}`,
    //     bodyText: dto.text,
    //   },
    // });

    // 3. Send email via Mailgun
    // await this.mailgunService.sendEmail(
    //   `${thread.listing.emailAlias}@inbox.yourapp.ca`,
    //   thread.sender.email,
    //   `Re: ${thread.subject}`,
    //   dto.text,
    // );

    // 4. Update thread lastMessageAt
    // await this.prisma.thread.update({
    //   where: { id: dto.threadId },
    //   data: { lastMessageAt: new Date() },
    // });

    console.log(`[STUB] Sending message in thread ${dto.threadId}`);
    console.log(`Text: ${dto.text}`);

    // Stubbed response
    return {
      id: `msg-${Date.now()}`,
      threadId: dto.threadId,
      senderId: null,
      senderEmail: 'l-abc123@inbox.yourapp.ca',
      senderName: 'Seller',
      direction: MessageDirection.OUTBOUND,
      subject: 'Re: Message',
      bodyText: dto.text,
      bodyHtml: null,
      rawEmailS3Key: null,
      createdAt: new Date(),
    };
  }
}

