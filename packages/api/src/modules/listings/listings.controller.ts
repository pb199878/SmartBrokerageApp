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

  @Get(':id/threads')
  async getListingThreads(@Param('id') id: string) {
    return this.listingsService.getListingThreads(id);
  }
}

