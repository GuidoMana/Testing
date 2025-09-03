// src\city\city.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from '../entities/city.entity';
import { CitiesService } from './city.service';
import { CitiesController } from './city.controller';
import { Province } from '../entities/province.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([City, Province]),
  ],
  controllers: [CitiesController],
  providers: [CitiesService],
  exports: [CitiesService],
})
export class CitiesModule { }
