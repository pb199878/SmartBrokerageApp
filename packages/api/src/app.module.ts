import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq'; // TODO: Uncomment when Redis is set up

import { PrismaModule } from './common/prisma/prisma.module';
import { MailgunModule } from './common/mailgun/mailgun.module';
import { SupabaseModule } from './common/supabase/supabase.module';
import { HelloSignModule } from './common/hellosign/hellosign.module';

import { ListingsModule } from './modules/listings/listings.module';
import { ThreadsModule } from './modules/threads/threads.module';
import { MessagesModule } from './modules/messages/messages.module';
import { EmailModule } from './modules/email/email.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ClassificationModule } from './modules/classification/classification.module';
import { OffersModule } from './modules/offers/offers.module';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      // In monorepo, explicitly point to .env file
      // This works whether .env is in root or symlinked in packages/api
      envFilePath: ['.env', '../../.env'],
    }),

    // TODO: Uncomment when Redis is available (Railway)
    BullModule.forRoot({
      connection: {
        host: process.env.REDISHOST || 'localhost',
        port: parseInt(process.env.REDISPORT || '6379'),
      },
    }),

    // Common modules
    PrismaModule,
    MailgunModule,
    SupabaseModule,
    HelloSignModule,

    // Feature modules
    ListingsModule,
    ThreadsModule,
    MessagesModule,
    EmailModule,
    AttachmentsModule,
    DocumentsModule,
    ClassificationModule,
    OffersModule,
  ],
})
export class AppModule {}

