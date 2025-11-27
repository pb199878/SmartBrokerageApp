import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MessageThread, MessageCategory } from '@smart-brokerage/shared';

@Injectable()
export class ThreadsService {
  constructor(private prisma: PrismaService) {}

  async getThread(id: string): Promise<MessageThread | null> {
    const thread = await this.prisma.thread.findUnique({
      where: { id },
      include: {
        sender: true,
        listing: {
          select: { id: true, address: true },
        },
      },
    });

    if (!thread) {
      return null;
    }

    return {
      id: thread.id,
      listingId: thread.listingId,
      senderId: thread.senderId,
      senderEmail: thread.sender.email,
      senderName: thread.sender.name,
      subject: thread.subject,
      category: thread.category as MessageCategory,
      lastMessageAt: thread.lastMessageAt,
      unreadCount: thread.unreadCount,
      isVerified: thread.sender.isVerified,
      listing: {
        id: thread.listing.id,
        address: thread.listing.address,
      },
    };
  }

  async getThreadMessages(threadId: string) {
    return this.prisma.message.findMany({
      where: { threadId },
      include: {
        attachments: {
          include: {
            documentAnalysis: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markThreadAsRead(threadId: string) {
    await this.prisma.thread.update({
      where: { id: threadId },
      data: { unreadCount: 0 },
    });
    
    return { success: true };
  }

  async getThreadOffers(threadId: string) {
    const offers = await this.prisma.offer.findMany({
      where: { 
        threadId,
        // Only return offers that should be visible in the UI
        // Exclude EXPIRED and SUPERSEDED offers from the list
        status: {
          notIn: ['EXPIRED', 'SUPERSEDED'],
        },
      },
      include: {
        messages: {
          include: {
            attachments: {
              include: {
                documentAnalysis: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { success: true, data: offers };
  }

  async getThreadsBySender(senderEmail: string) {
    const sender = await this.prisma.sender.findUnique({
      where: { email: senderEmail },
    });

    if (!sender) {
      return [];
    }

    return this.prisma.thread.findMany({
      where: { senderId: sender.id },
      include: {
        listing: true,
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }
}

