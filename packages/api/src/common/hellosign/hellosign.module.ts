import { Module } from '@nestjs/common';
import { HelloSignService } from './hellosign.service';

@Module({
  providers: [HelloSignService],
  exports: [HelloSignService],
})
export class HelloSignModule {}

