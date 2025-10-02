import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MessageThread, MessageCategory } from '@smart-brokerage/shared';

@Injectable()
export class ThreadsService {
  constructor(private prisma: PrismaService) {}

  async getThread(id: string): Promise<MessageThread | null> {
    // TODO: Implement when DB is connected
    // return this.prisma.thread.findUnique({
    //   where: { id },
    //   include: {
    //     sender: true,
    //     listing: {
    //       select: { id: true, address: true },
    //     },
    //   },
    // });

    // Stubbed mock data
    return {
      id,
      listingId: '1',
      senderId: 'sender-1',
      senderEmail: 'john.agent@remax.com',
      senderName: 'John Smith',
      subject: 'Interested in viewing the property',
      category: MessageCategory.SHOWING,
      lastMessageAt: new Date(),
      unreadCount: 2,
      isVerified: true,
      listing: {
        id: '1',
        address: '123 Main Street',
      },
    };
  }

  async getThreadMessages(threadId: string) {
    // TODO: Implement when DB is connected
    // return this.prisma.message.findMany({
    //   where: { threadId },
    //   include: {
    //     attachments: true,
    //   },
    //   orderBy: { createdAt: 'asc' },
    // });

    // Stubbed mock messages
    return [
      {
        id: 'msg-1',
        threadId,
        senderId: 'sender-1',
        senderEmail: 'john.agent@remax.com',
        senderName: 'John Smith',
        direction: 'INBOUND',
        subject: 'Interested in viewing the property',
        bodyText: 'Hi, I have a buyer interested in viewing your property at 123 Main Street. Would you be available this Saturday at 2 PM?',
        bodyHtml: null,
        rawEmailS3Key: null,
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        attachments: [],
      },
      {
        id: 'msg-2',
        threadId,
        senderId: null,
        senderEmail: 'l-abc123@inbox.yourapp.ca',
        senderName: 'Seller',
        direction: 'OUTBOUND',
        subject: 'Re: Interested in viewing the property',
        bodyText: 'Yes, Saturday at 2 PM works great. Please have your buyer bring their pre-approval letter.',
        bodyHtml: null,
        rawEmailS3Key: null,
        createdAt: new Date(Date.now() - 43200000), // 12 hours ago
        attachments: [],
      },
    ];
  }

  async markThreadAsRead(threadId: string) {
    // TODO: Implement when DB is connected
    // return this.prisma.thread.update({
    //   where: { id: threadId },
    //   data: { unreadCount: 0 },
    // });

    console.log(`[STUB] Marking thread ${threadId} as read`);
    return { success: true };
  }

  async getThreadsBySender(senderEmail: string) {
    // TODO: Implement
    return [];
  }
}

