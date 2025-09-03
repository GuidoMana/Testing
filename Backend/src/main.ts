// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  app.use(helmet()); // Aplica headers de seguridad básicos
  app.enableCors({
    origin: 'http://localhost:4200',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  });
  app.use(cookieParser()); // Permite parsear cookies
  app.useGlobalPipes(new ValidationPipe({ // Aplica validación global a todos los DTOs
    whitelist: true, // Elimina propiedades no definidas en el DTO
    forbidNonWhitelisted: true, // Lanza error si hay propiedades extras
    transform: true, // Transforma los payloads a instancias de DTOs
    transformOptions: {
      enableImplicitConversion: true, // Permite conversión implícita de tipos
    },
  }));

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port, '0.0.0.0'); // Escucha en todas las interfaces de red

  logger.log(`🚀 Servidor corriendo en: http://localhost:${port}`);
  logger.log(`🔧 Entorno actual (NODE_ENV): ${configService.get<string>('NODE_ENV', 'development')}`);
}
bootstrap();