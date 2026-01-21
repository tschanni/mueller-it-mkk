import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Config Service
  const configService = app.get(ConfigService);

  // Security: Helmet
  app.use(helmet());

  // CORS Configuration
  app.enableCors({
    origin: configService.get('CORS_ORIGIN') || '*',
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Serve static files (uploads)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Mueller IT Backend API')
    .setDescription('Backend API für User Authentication und Ticket/Chat System')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'User Registration, Login, Refresh Token')
    .addTag('Users', 'User-Profil und Profilbild-Verwaltung')
    .addTag('Tickets', 'Ticket-Management für angemeldete User')
    .addTag('Admin', 'Admin-spezifische Endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Start Server
  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  console.log(`🚀 Server läuft auf: http://localhost:${port}`);
  console.log(`📚 Swagger Docs: http://localhost:${port}/api`);
}

bootstrap();
