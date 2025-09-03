// src/countries/country.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from '../entities/country.entity';
import { CountriesService } from './country.service';
import { CountriesController } from './country.controller';


@Module({
  imports: [
    TypeOrmModule.forFeature([Country]),
  ],
  controllers: [CountriesController], // Controlador para las rutas de países
  providers: [CountriesService], // Servicio con la lógica de negocio para países
  exports: [CountriesService], // Exporta el servicio si otros módulos lo necesitan
})
export class CountriesModule { }
