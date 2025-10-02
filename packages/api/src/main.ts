import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Enable CORS for mobile app
  app.enableCors({
    origin: ['http://localhost:8081', 'exp://192.168.*.*:*'], // Expo dev
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 API running on: http://localhost:${port}`);
}

bootstrap();

