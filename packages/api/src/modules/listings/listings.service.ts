import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateListingDto, Listing, ListingStatus } from '@smart-brokerage/shared';

@Injectable()
export class ListingsService {
  constructor(private prisma: PrismaService) {}

  async getListings(): Promise<Listing[]> {
    const listings = await this.prisma.listing.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    return listings as Listing[];
  }

  async getListing(id: string): Promise<Listing | null> {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    return listing as Listing | null;
  }

  async createListing(dto: CreateListingDto): Promise<Listing> {
    // Generate unique email alias
    const emailAlias = `l-${this.generateShortId()}`;
    
    const listing = await this.prisma.listing.create({
      data: {
        ...dto,
        emailAlias,
      },
    });
    return listing as Listing;
  }

  async getListingSenders(listingId: string) {
    const threads = await this.prisma.thread.findMany({
      where: { listingId },
      include: {
        sender: true,
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Group threads by sender
    const senderMap = new Map();
    
    for (const thread of threads) {
      const senderId = thread.senderId;
      
      if (!senderMap.has(senderId)) {
        senderMap.set(senderId, {
          id: thread.sender.id,
          email: thread.sender.email,
          name: thread.sender.name,
          isVerified: thread.sender.isVerified,
          brokerage: thread.sender.brokerage,
          threadCount: 0,
          unreadCount: 0,
          lastMessageAt: thread.lastMessageAt,
          lastSubject: thread.subject,
        });
      }

      const senderData = senderMap.get(senderId);
      senderData.threadCount++;
      senderData.unreadCount += thread.unreadCount;
      
      // Update if this thread is more recent
      if (thread.lastMessageAt > senderData.lastMessageAt) {
        senderData.lastMessageAt = thread.lastMessageAt;
        senderData.lastSubject = thread.subject;
      }
    }

    return Array.from(senderMap.values())
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async getListingThreadsBySender(listingId: string, senderId: string) {
    const threads = await this.prisma.thread.findMany({
      where: { 
        listingId,
        senderId,
      },
      include: {
        sender: true,
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return threads.map(thread => ({
      id: thread.id,
      listingId: thread.listingId,
      senderId: thread.senderId,
      senderEmail: thread.sender.email,
      senderName: thread.sender.name,
      subject: thread.subject,
      category: thread.category,
      lastMessageAt: thread.lastMessageAt,
      unreadCount: thread.unreadCount,
      isVerified: thread.sender.isVerified,
      messageCount: thread._count.messages,
    }));
  }

  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
}

