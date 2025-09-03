// src/database/data-seeding/data-seeding.service.ts
import { Injectable, Logger, OnApplicationBootstrap, ConflictException, NotFoundException } from '@nestjs/common';
import { CountriesService } from '../../country/country.service';
import { ProvincesService } from '../../province/province.service';
import { CitiesService } from '../../city/city.service';
import { GeorefService } from '../../georef/georef.service';
import { GeorefProvincia, GeorefMunicipio } from '../../interfaces/georef.interfaces';
import { CreateCountryDto } from '../../dto/create-country.dto';
import { CreateProvinceDto } from '../../dto/create-province.dto';
import { CreateCityDto } from '../../dto/create-city.dto';
import { ConfigService } from '@nestjs/config';
import { Country } from '../../entities/country.entity';
import { Province } from '../../entities/province.entity'; 
import { City } from '../../entities/city.entity'; 

@Injectable()
export class DataSeedingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DataSeedingService.name);

  constructor(
    private readonly countriesService: CountriesService,
    private readonly provincesService: ProvincesService,
    private readonly citiesService: CitiesService,
    private readonly georefService: GeorefService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const runSeeding = this.configService.get<string>('RUN_SEEDING') === 'true';
    if (runSeeding) {
      this.logger.log('Iniciando siembra de datos desde Georef API...');
      await this.seedDatabase();
      this.logger.log('Siembra de datos completada.');
    } else {
      this.logger.log('Siembra de datos omitida (RUN_SEEDING no es "true").');
    }
  }

  async seedDatabase() {
    this.logger.log('Verificando/Creando país Argentina...');
    let argentinaCountry: Country | null = null;
    try {
      const result = await this.countriesService.findOneByName('Argentina', false, true);
      if (result) {
        argentinaCountry = result as Country; 
      }

      if (!argentinaCountry) {
        const countryDto: CreateCountryDto = { name: 'Argentina', code: 'AR' };
        const createdResult = await this.countriesService.create(countryDto, true);
        argentinaCountry = createdResult as Country; 
        this.logger.log(`País '${argentinaCountry.name}' creado ID: ${argentinaCountry.id}`);
      } else {
        this.logger.log(`País '${argentinaCountry.name}' ya existe ID: ${argentinaCountry.id}`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
          this.logger.log("País Argentina no encontrado, creando...");
          const countryDto: CreateCountryDto = { name: 'Argentina', code: 'AR' };
          const createdResult = await this.countriesService.create(countryDto, true);
          argentinaCountry = createdResult as Country; 
          this.logger.log(`País '${argentinaCountry.name}' creado ID: ${argentinaCountry.id}`);
      } else if (error instanceof ConflictException) {
          this.logger.warn(`Conflicto al crear Argentina: ${error.message}. Intentando obtenerlo...`);
          const foundResult = await this.countriesService.findOneByName('Argentina', false, true);
          if (foundResult) {
            argentinaCountry = foundResult as Country; 
          }
      } else {
          this.logger.error('Error al procesar país Argentina:', error instanceof Error ? error.stack : String(error));
          return;
      }
    }
    if (!argentinaCountry) {
        this.logger.error('No se pudo obtener/crear país Argentina. Deteniendo siembra.');
        return;
    }

    const georefProvinceIdToLocalDataMap = new Map<string, { localId: number, name: string }>();
    this.logger.log('Sembrando provincias desde Georef API...');
    try {
      const georefProvinces: GeorefProvincia[] = await this.georefService.getProvincias();
      this.logger.log(`Obtenidas ${georefProvinces.length} provincias de Georef.`);
      for (const georefProv of georefProvinces) {
        if (!georefProv.centroide || typeof georefProv.centroide.lat !== 'number' || typeof georefProv.centroide.lon !== 'number') {
            this.logger.warn(`Provincia '${georefProv.nombre}' (Georef ID: ${georefProv.id}) sin coordenadas válidas. Omitiendo.`);
            continue;
        }
        try {
            const provinceDto: CreateProvinceDto = {
                name: georefProv.nombre,
                countryId: argentinaCountry.id,
                latitude: georefProv.centroide.lat,
                longitude: georefProv.centroide.lon,
            };

            const processedProvince = await this.provincesService.create(provinceDto, true) as Province;
            this.logger.log(`Provincia procesada: '${processedProvince.name}', ID local: ${processedProvince.id}, Lat: ${processedProvince.latitude}, Lon: ${processedProvince.longitude} (Georef ID: ${georefProv.id})`);
            georefProvinceIdToLocalDataMap.set(georefProv.id, { localId: processedProvince.id, name: processedProvince.name });
        } catch (error) {
            if (!(error instanceof ConflictException)) {
                 this.logger.error(`Error al procesar provincia '${georefProv.nombre}' (Georef ID: ${georefProv.id}):`, error instanceof Error ? error.message : String(error));
            } else {
    
                const existingProv = await this.provincesService.findOneByNameAndCountryId(georefProv.nombre, argentinaCountry.id, false, true) as Province;
                if (existingProv) {
                    this.logger.log(`Provincia '${georefProv.nombre}' ya existía, ID local: ${existingProv.id}`);
                    georefProvinceIdToLocalDataMap.set(georefProv.id, { localId: existingProv.id, name: existingProv.name });
                } else {
                    this.logger.error(`No se pudo obtener la provincia '${georefProv.nombre}' después de un conflicto.`);
                }
            }
        }
      }
    } catch (error) {
      this.logger.error('Error obteniendo provincias de Georef:', error instanceof Error ? error.stack : String(error));
    }

    this.logger.log('Sembrando ciudades (municipios) desde Georef API...');
    let citiesAttempted = 0, citiesProcessed = 0, citiesSkipped = 0, citiesFailed = 0;
    try {
      const georefMunicipios: GeorefMunicipio[] = await this.georefService.getMunicipios();
      this.logger.log(`Obtenidos ${georefMunicipios.length} municipios de Georef.`);
      for (const georefMuni of georefMunicipios) {
        citiesAttempted++;
        const provinceData = georefProvinceIdToLocalDataMap.get(georefMuni.provincia.id);
        if (!provinceData) {
          this.logger.warn(`Provincia local no encontrada para municipio '${georefMuni.nombre}' (Prov. Georef ID: ${georefMuni.provincia.id}). Omitiendo.`);
          citiesSkipped++;
          continue;
        }
        if (!georefMuni.centroide || typeof georefMuni.centroide.lat !== 'number' || typeof georefMuni.centroide.lon !== 'number') {
            this.logger.warn(`Municipio '${georefMuni.nombre}' (Georef ID: ${georefMuni.id}) sin coordenadas válidas. Omitiendo.`);
            citiesSkipped++;
            continue;
        }
        try {
          const cityDto: CreateCityDto = {
            name: georefMuni.nombre,
            provinceId: provinceData.localId,
            latitude: georefMuni.centroide.lat,
            longitude: georefMuni.centroide.lon,
          };
          const processedCity = await this.citiesService.create(cityDto, true) as City;
          this.logger.log(`Ciudad procesada: '${processedCity.name}', ID local: ${processedCity.id}`);
          citiesProcessed++;
        } catch (error) {
            if (!(error instanceof ConflictException)){
                this.logger.error(`Error al procesar ciudad '${georefMuni.nombre}' (Georef ID: ${georefMuni.id}):`, error instanceof Error ? error.message : String(error));
                citiesFailed++;
            } else {
    
                const existingCity = await this.citiesService.findOneByNameAndProvinceId(georefMuni.nombre, provinceData.localId, false, true) as City;
                if(existingCity) {
                    this.logger.log(`Ciudad '${georefMuni.nombre}' ya existía, ID local: ${existingCity.id}`);
                    citiesProcessed++;
                } else {
                    this.logger.error(`No se pudo obtener la ciudad '${georefMuni.nombre}' después de un conflicto.`);
                    citiesFailed++;
                }
            }
        }
      }
    } catch (error) {
      this.logger.error('Error obteniendo municipios de Georef:', error instanceof Error ? error.stack : String(error));
    } finally {
        this.logger.log(`Resumen Siembra Ciudades: Intentadas=${citiesAttempted}, Procesadas=${citiesProcessed}, Omitidas=${citiesSkipped}, Fallidas=${citiesFailed}`);
    }
  }
}