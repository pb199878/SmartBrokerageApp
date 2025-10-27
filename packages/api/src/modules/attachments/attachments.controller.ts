import { Controller, Get, Param } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * Get attachment metadata
   * GET /attachments/:id
   */
  @Get(':id')
  async getAttachment(@Param('id') id: string) {
    const attachment = await this.attachmentsService.getAttachment(id);
    return { success: true, data: attachment };
  }

  /**
   * Get signed download URL for attachment
   * GET /attachments/:id/download
   */
  @Get(':id/download')
  async getDownloadUrl(@Param('id') id: string) {
    const url = await this.attachmentsService.getDownloadUrl(id);
    return { success: true, data: { url } };
  }

  /**
   * Get preview/thumbnail URL for attachment
   * GET /attachments/:id/preview
   * 
   * For now, returns the same as download URL
   * TODO: Implement thumbnail generation for images/PDFs
   */
  @Get(':id/preview')
  async getPreviewUrl(@Param('id') id: string) {
    const url = await this.attachmentsService.getDownloadUrl(id);
    return { success: true, data: { url } };
  }
}

