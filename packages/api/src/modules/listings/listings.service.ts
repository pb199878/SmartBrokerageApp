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

  async getListingThreads(listingId: string) {
    const threads = await this.prisma.thread.findMany({
      where: { listingId },
      include: {
        sender: true,
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Map to match expected format
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
    }));
  }

  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
}

