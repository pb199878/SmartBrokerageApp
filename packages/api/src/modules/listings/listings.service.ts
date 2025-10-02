import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateListingDto, Listing, ListingStatus } from '@smart-brokerage/shared';

@Injectable()
export class ListingsService {
  constructor(private prisma: PrismaService) {}

  async getListings(): Promise<Listing[]> {
    // TODO: Implement when DB is connected
    // return this.prisma.listing.findMany({
    //   where: { status: 'ACTIVE' },
    //   orderBy: { createdAt: 'desc' },
    // });

    // Stubbed mock data for local dev
    return [
      {
        id: '1',
        address: '123 Main Street',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 1A1',
        price: 850000,
        emailAlias: 'l-abc123',
        sellerId: 'seller-1',
        status: ListingStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        address: '456 Oak Avenue',
        city: 'Mississauga',
        province: 'ON',
        postalCode: 'L5B 2N1',
        price: 650000,
        emailAlias: 'l-def456',
        sellerId: 'seller-1',
        status: ListingStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  async getListing(id: string): Promise<Listing | null> {
    // TODO: Implement when DB is connected
    // return this.prisma.listing.findUnique({ where: { id } });

    const listings = await this.getListings();
    return listings.find(l => l.id === id) || null;
  }

  async createListing(dto: CreateListingDto): Promise<Listing> {
    // TODO: Implement when DB is connected
    // Generate unique email alias
    // const emailAlias = `l-${this.generateShortId()}`;
    
    // return this.prisma.listing.create({
    //   data: {
    //     ...dto,
    //     emailAlias,
    //   },
    // });

    // Stubbed
    return {
      id: Date.now().toString(),
      ...dto,
      emailAlias: `l-${Math.random().toString(36).substring(7)}`,
      status: ListingStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getListingThreads(listingId: string) {
    // TODO: Implement when DB is connected
    // return this.prisma.thread.findMany({
    //   where: { listingId },
    //   include: {
    //     sender: true,
    //     _count: {
    //       select: { messages: true },
    //     },
    //   },
    //   orderBy: { lastMessageAt: 'desc' },
    // });

    // Stubbed mock threads
    return [
      {
        id: 'thread-1',
        listingId,
        senderId: 'sender-1',
        senderEmail: 'john.agent@remax.com',
        senderName: 'John Smith',
        subject: 'Interested in viewing the property',
        category: 'SHOWING',
        lastMessageAt: new Date(Date.now() - 3600000), // 1 hour ago
        unreadCount: 2,
        isVerified: true,
      },
      {
        id: 'thread-2',
        listingId,
        senderId: 'sender-2',
        senderEmail: 'sarah.jones@royallepage.ca',
        senderName: 'Sarah Jones',
        subject: 'Offer for your property',
        category: 'OFFER',
        lastMessageAt: new Date(Date.now() - 86400000), // 1 day ago
        unreadCount: 0,
        isVerified: true,
      },
    ];
  }

  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
}

