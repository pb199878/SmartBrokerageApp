import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Configure body parser with larger limits for Mailgun webhooks
    // Mailgun sends webhooks as:
    // - application/x-www-form-urlencoded (no attachments)  
    // - multipart/form-data (with attachments - handled by multer in controller)
    bodyParser: true,
    rawBody: true, // Keep raw body for webhook signature verification
  });

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Increase payload size limits for Mailgun webhooks (attachment metadata can be large)
  const express = await import('express');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Enable CORS for mobile app
  app.enableCors({
    origin: ['http://localhost:8081', 'exp://192.168.*.*:*'], // Expo dev
    credentials: true,
  });

  // Trust Railway's proxy
  if (process.env.RAILWAY_ENVIRONMENT) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
    console.log('🚂 Running on Railway - trusting proxy');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 API running on: http://localhost:${port}`);
}

bootstrap();

