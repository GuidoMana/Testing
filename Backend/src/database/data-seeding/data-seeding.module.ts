// src/database/data-seeding/data-seeding.module.ts
import { Module, Logger } from '@nestjs/common';
import { DataSeedingService } from './data-seeding.service';
import { CountriesModule } from '../../country/country.module';
import { ProvincesModule } from '../../province/province.module';
import { CitiesModule } from '../../city/city.module';
import { GeorefModule } from '../../georef/georef.module';
import { ConfigModule } from '@nestjs/config';
import { DataSeedingController } from './data-seeding.controller';

@Module({
  imports: [
    ConfigModule,
    CountriesModule,
    ProvincesModule,
    CitiesModule,
    GeorefModule,
  ],
  controllers: [DataSeedingController],
  providers: [DataSeedingService],
  exports: [DataSeedingService],
})
export class DataSeedingModule { }
