import { Controller, Post, Get, Body, Param, HttpCode } from '@nestjs/common';
import { AgreementsService } from './agreements.service';
import {
  PrepareAgreementRequest,
  PrepareAgreementResponse,
  AgreementDetail,
  ApiResponse,
} from '@smart-brokerage/shared';

@Controller('agreements')
export class AgreementsController {
  constructor(private readonly agreementsService: AgreementsService) {}

  /**
   * POST /agreements/aps/prepare
   * Prepare an APS for seller signing
   */
  @Post('aps/prepare')
  @HttpCode(200)
  async prepareAgreement(
    @Body() request: PrepareAgreementRequest,
  ): Promise<ApiResponse<PrepareAgreementResponse>> {
    try {
      const result = await this.agreementsService.prepareAgreement(request);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * GET /agreements/:id
   * Get agreement details
   */
  @Get(':id')
  async getAgreement(
    @Param('id') id: string,
  ): Promise<ApiResponse<AgreementDetail>> {
    try {
      const agreement = await this.agreementsService.getAgreement(id);
      return {
        success: true,
        data: agreement,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

