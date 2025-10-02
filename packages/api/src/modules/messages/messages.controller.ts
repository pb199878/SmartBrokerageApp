import { Controller, Post, Body, Param } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from '@smart-brokerage/shared';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(dto);
  }
}

