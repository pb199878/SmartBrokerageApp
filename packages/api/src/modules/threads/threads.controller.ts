import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ThreadsService } from './threads.service';

@Controller('threads')
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get(':id')
  async getThread(@Param('id') id: string) {
    return this.threadsService.getThread(id);
  }

  @Get(':id/messages')
  async getThreadMessages(@Param('id') id: string) {
    return this.threadsService.getThreadMessages(id);
  }

  @Get(':id/offers')
  async getThreadOffers(@Param('id') id: string) {
    return this.threadsService.getThreadOffers(id);
  }

  @Patch(':id/read')
  async markThreadAsRead(@Param('id') id: string) {
    return this.threadsService.markThreadAsRead(id);
  }
}

