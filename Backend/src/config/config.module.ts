// src\config\config.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env', // Carga .env o .env.test
      ignoreEnvFile: process.env.NODE_ENV === 'production', // Ignorar .env en producción
      isGlobal: true, // Hace que las variables de configuración estén disponibles globalmente
    }),
  ],
  exports: [NestConfigModule], // Exporta NestConfigModule para que otros módulos puedan inyectar ConfigService
})
export class ConfigModule {} // Nombre de clase corregido a ConfigModule
