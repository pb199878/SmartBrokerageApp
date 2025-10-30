import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { OffersService } from './offers.service';
import { DeclineOfferDto, CounterOfferDto } from '@smart-brokerage/shared';

@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  /**
   * Get offer by ID
   * GET /offers/:id
   */
  @Get(':id')
  async getOffer(@Param('id') id: string) {
    const offer = await this.offersService.getOffer(id);
    return { success: true, data: offer };
  }

  /**
   * Accept offer - Creates signature request
   * POST /offers/:id/accept
   * Returns signing URL for embedded WebView
   */
  @Post(':id/accept')
  async acceptOffer(@Param('id') id: string) {
    const result = await this.offersService.acceptOffer(id);
    return { success: true, data: result };
  }

  /**
   * Get signing URL for offer awaiting seller signature
   * GET /offers/:id/sign-url
   * Returns fresh signing URL if one already exists
   */
  @Get(':id/sign-url')
  async getSignUrl(@Param('id') id: string) {
    const result = await this.offersService.getSignUrl(id);
    return { success: true, data: result };
  }

  /**
   * Reset offer back to PENDING_REVIEW
   * POST /offers/:id/reset
   * Use this if offer gets stuck in AWAITING_SELLER_SIGNATURE due to errors
   */
  @Post(':id/reset')
  async resetOffer(@Param('id') id: string) {
    const offer = await this.offersService.resetOffer(id);
    return { success: true, data: offer };
  }

  /**
   * Decline offer
   * POST /offers/:id/decline
   */
  @Post(':id/decline')
  async declineOffer(@Body() dto: DeclineOfferDto) {
    const offer = await this.offersService.declineOffer(dto);
    return { success: true, data: offer };
  }

  /**
   * Create counter-offer
   * POST /offers/:id/counter
   * Returns signing URL for embedded WebView
   */
  @Post(':id/counter')
  async counterOffer(@Body() dto: CounterOfferDto) {
    const result = await this.offersService.counterOffer(dto);
    return { success: true, data: result };
  }
}

