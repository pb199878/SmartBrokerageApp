import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { BullModule } from '@nestjs/bullmq'; // TODO: Uncomment when Redis is set up

import { PrismaModule } from './common/prisma/prisma.module';
import { MailgunModule } from './common/mailgun/mailgun.module';
import { SupabaseModule } from './common/supabase/supabase.module';

import { ListingsModule } from './modules/listings/listings.module';
import { ThreadsModule } from './modules/threads/threads.module';
import { MessagesModule } from './modules/messages/messages.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // TODO: Uncomment when Redis is available (Railway)
    // BullModule.forRoot({
    //   connection: {
    //     host: process.env.REDIS_HOST || 'localhost',
    //     port: parseInt(process.env.REDIS_PORT || '6379'),
    //   },
    // }),

    // Common modules
    PrismaModule,
    MailgunModule,
    SupabaseModule,

    // Feature modules
    ListingsModule,
    ThreadsModule,
    MessagesModule,
    EmailModule,
  ],
})
export class AppModule {}

