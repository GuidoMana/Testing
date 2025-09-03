// src/georef/georef.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map, catchError } from 'rxjs';
import { AxiosError } from 'axios';

import {
  GeorefProvincia,
  GeorefProvinciasResponse,
  GeorefMunicipio,
  GeorefMunicipiosResponse
} from '../interfaces/georef.interfaces';

@Injectable()
export class GeorefService {
  private readonly logger = new Logger(GeorefService.name);

  constructor(
    private readonly httpService: HttpService,
  ) { }

  async getProvincias(): Promise<GeorefProvincia[]> {
    this.logger.log('Obteniendo provincias (con centroides) desde Georef API...');
    try {
      const params = { campos: 'id,nombre,centroide.lat,centroide.lon', max: 50 };
      const response = await firstValueFrom(
        this.httpService.get<GeorefProvinciasResponse>('/provincias', { params })
          .pipe(
            map(res => res.data.provincias),
            catchError((error: AxiosError) => {
              this.logger.error(`Error obteniendo provincias de Georef: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`, error.stack);
              throw `Error al obtener provincias de Georef: ${error.message}`;
            }),
          ),
      );
      this.logger.log(`Se obtuvieron ${response.length} provincias de Georef.`);
      return response;
    } catch (error) {
      this.logger.error('Falló la llamada a GeorefService.getProvincias', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  async getMunicipios(): Promise<GeorefMunicipio[]> {
    this.logger.log('Obteniendo municipios (con centroides) desde Georef API...');
    try {
      const params = { campos: 'id,nombre,provincia.id,provincia.nombre,centroide.lat,centroide.lon', max: 5000 };
      const response = await firstValueFrom(
        this.httpService.get<GeorefMunicipiosResponse>('/municipios', { params })
          .pipe(
            map(res => res.data.municipios),
            catchError((error: AxiosError) => {
              this.logger.error(`Error obteniendo municipios de Georef: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`, error.stack);
              throw `Error al obtener municipios de Georef: ${error.message}`;
            }),
          ),
      );
      this.logger.log(`Se obtuvieron ${response.length} municipios de Georef.`);
      return response;
    } catch (error) {
      this.logger.error('Falló la llamada a GeorefService.getMunicipios', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}