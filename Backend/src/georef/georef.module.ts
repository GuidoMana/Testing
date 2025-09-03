// src/georef/georef.module.ts
import { Module, Logger } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GeorefService } from './georef.service';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://apis.datos.gob.ar/georef/api',
      timeout: 15000,
      headers: { 'Accept': 'application/json' },
    }),
  ],
  providers: [GeorefService, Logger],
  exports: [GeorefService],
})
export class GeorefModule { }