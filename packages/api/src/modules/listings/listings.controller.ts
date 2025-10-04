import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from '@smart-brokerage/shared';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  async getListings() {
    return this.listingsService.getListings();
  }

  @Get(':id')
  async getListing(@Param('id') id: string) {
    return this.listingsService.getListing(id);
  }

  @Post()
  async createListing(@Body() dto: CreateListingDto) {
    return this.listingsService.createListing(dto);
  }

  // @Get(':id/threads')
  // async getListingThreads(@Param('id') id: string) {
  //   return this.listingsService.getListingThreads(id);
  // }

  /**
   * Get all unique senders for a listing
   */
  @Get(':id/senders')
  async getListingSenders(@Param('id') id: string) {
    const senders = await this.listingsService.getListingSenders(id);
    return { success: true, data: senders };
  }

  /**
   * Get all threads between a listing and a specific sender
   */
  @Get(':listingId/senders/:senderId/threads')
  async getListingThreadsBySender(
    @Param('listingId') listingId: string,
    @Param('senderId') senderId: string,
  ) {
    const threads = await this.listingsService.getListingThreadsBySender(listingId, senderId);
    return { success: true, data: threads };
  }
}

