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

  /**
   * Get all offers for a listing with optional status filtering
   * Includes offer conditions, thread info, and sender info
   */
  async getListingOffers(listingId: string, statusFilter?: string[]) {
    // Build the status filter - exclude EXPIRED and SUPERSEDED by default
    const defaultExcludedStatuses = ['EXPIRED', 'SUPERSEDED'];
    
    let statusCondition: any = {};
    if (statusFilter && statusFilter.length > 0) {
      // If specific statuses requested, use those
      statusCondition = { in: statusFilter };
    } else {
      // Default: exclude EXPIRED and SUPERSEDED
      statusCondition = { notIn: defaultExcludedStatuses };
    }

    // Find all offers for threads belonging to this listing
    const offers = await this.prisma.offer.findMany({
      where: {
        thread: {
          listingId,
        },
        status: statusCondition,
      },
      include: {
        thread: {
          include: {
            sender: true,
            listing: true,
          },
        },
        offerConditions: {
          orderBy: { createdAt: 'asc' },
        },
        messages: {
          include: {
            attachments: {
              include: {
                documentAnalysis: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1, // Only get the most recent message with attachments
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform the data to include condition summary
    return offers.map(offer => {
      const pendingConditions = offer.offerConditions.filter(c => c.status === 'PENDING').length;
      const completedConditions = offer.offerConditions.filter(c => c.status === 'COMPLETED').length;
      const expiredConditions = offer.offerConditions.filter(c => c.status === 'EXPIRED').length;
      const waivedConditions = offer.offerConditions.filter(c => c.status === 'WAIVED').length;
      const totalConditions = offer.offerConditions.length;

      return {
        id: offer.id,
        threadId: offer.threadId,
        messageId: offer.messageId,
        status: offer.status,
        price: offer.price,
        deposit: offer.deposit,
        closingDate: offer.closingDate,
        conditions: offer.conditions,
        expiryDate: offer.expiryDate,
        conditionallyAcceptedAt: offer.conditionallyAcceptedAt,
        acceptedAt: offer.acceptedAt,
        originalDocumentS3Key: offer.originalDocumentS3Key,
        signedDocumentS3Key: offer.signedDocumentS3Key,
        counterOfferDocumentS3Key: offer.counterOfferDocumentS3Key,
        preparedDocumentS3Key: offer.preparedDocumentS3Key,
        isCounterOffer: offer.isCounterOffer,
        originalOfferId: offer.originalOfferId,
        declineReason: offer.declineReason,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
        // Sender info from thread
        senderName: offer.thread.sender.name,
        senderEmail: offer.thread.sender.email,
        senderId: offer.thread.sender.id,
        senderBrokerage: offer.thread.sender.brokerage,
        // Listing info
        listingId: offer.thread.listingId,
        listingAddress: offer.thread.listing.address,
        // Condition summary
        conditionSummary: {
          total: totalConditions,
          pending: pendingConditions,
          completed: completedConditions,
          expired: expiredConditions,
          waived: waivedConditions,
        },
        // Full conditions list
        offerConditions: offer.offerConditions,
        // Attachments from associated message
        attachments: offer.messages[0]?.attachments || [],
      };
    });
  }

  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
}

