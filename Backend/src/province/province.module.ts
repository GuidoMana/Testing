// src/province/province.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Province } from '../entities/province.entity';
import { ProvincesService } from './province.service';
import { ProvincesController } from './province.controller';
import { Country } from '../entities/country.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Province, Country]), // Registra Province y Country
  ],
  controllers: [ProvincesController],
  providers: [ProvincesService],
  exports: [ProvincesService], // Exporta el servicio si otros módulos lo necesitan
})
export class ProvincesModule { }
