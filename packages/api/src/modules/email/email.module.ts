import { Module } from '@nestjs/common';
// import { BullModule } from '@nestjs/bullmq'; // TODO: Uncomment when Redis is set up
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
// import { EmailProcessor } from './email.processor'; // TODO: Uncomment when BullMQ is set up
import { AttachmentsModule } from '../attachments/attachments.module';
import { DocumentsModule } from '../documents/documents.module';
import { ClassificationModule } from '../classification/classification.module';

@Module({
  imports: [
    AttachmentsModule,
    DocumentsModule,
    ClassificationModule,
    // TODO: Uncomment when Redis is available
    // BullModule.registerQueue({
    //   name: 'email-processing',
    // }),
  ],
  controllers: [EmailController],
  providers: [
    EmailService,
    // EmailProcessor, // TODO: Add when BullMQ is set up
  ],
})
export class EmailModule {}

