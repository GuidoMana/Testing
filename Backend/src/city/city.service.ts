// src/city/city.service.ts
import { Injectable, NotFoundException, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not, FindManyOptions, FindOptionsWhere } from 'typeorm';
import { City } from '../entities/city.entity';
import { Province } from '../entities/province.entity';
import { CreateCityDto } from '../dto/create-city.dto';
import { UpdateCityDto } from '../dto/update-patch-city.dto';
import { UpdatePutCityDto } from '../dto/update-put-city.dto';
import { CityResponseDto } from '../interfaces/city.interfaces';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

@Injectable()
export class CitiesService {
  private readonly logger = new Logger(CitiesService.name);

  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
  ) { }

  // defaultRelations solo para 'province' y 'province.country' en CityResponseDto
  private readonly defaultRelations = ['province', 'province.country'];

  private async findProvinceById(provinceId: number): Promise<Province> {
    this.logger.debug(`Buscando provincia ID: ${provinceId}`);
    const province = await this.provinceRepository.findOne({
      where: { id: provinceId },
      relations: ['country'],
    });
    if (!province) {
      this.logger.warn(`Provincia ID ${provinceId} no encontrada.`);
      throw new NotFoundException(`Provincia con ID ${provinceId} no encontrada.`);
    }
    return province;
  }

  async findByProvince(provinceId: number): Promise<PaginatedResponseDto<CityResponseDto>> {
    this.logger.log(`Buscando todas las ciudades para la provincia con ID: ${provinceId}`);

    const [cities, total] = await this.cityRepository.findAndCount({
      where: {
        // Filtramos las ciudades por el ID de su provincia relacionada
        province: { id: provinceId }
      },
      order: { name: 'ASC' }
    });

    return new PaginatedResponseDto(cities, total, 1, total);
  }

  private mapToResponseDto(city: City): CityResponseDto {
    if (!city.province || !city.province.country) {
      this.logger.error(`Ciudad ID ${city.id} sin relación 'province' o 'country' cargada para DTO.`);
      throw new Error('Las relaciones de provincia/país no están cargadas para la ciudad.');
    }
    return {
      id: city.id,
      name: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
      province: {
        id: city.province.id,
        name: city.province.name,
        // country: {
        //   id: city.province.country.id,
        //   name: city.province.country.name,
        // },
      },
    };
  }

  async create(createCityDto: CreateCityDto, returnEntity: boolean = false): Promise<City | CityResponseDto> {
    this.logger.debug(`Intentando crear ciudad: ${createCityDto.name}, Lat: ${createCityDto.latitude}, Lon: ${createCityDto.longitude}`);
    const province = await this.findProvinceById(createCityDto.provinceId);

    const existingCityByCoords = await this.cityRepository.findOne({
      where: {
        latitude: createCityDto.latitude,
        longitude: createCityDto.longitude,
      }
    });

    if (existingCityByCoords) {
      this.logger.log(`Ciudad en Lat: ${createCityDto.latitude}, Lon: ${createCityDto.longitude} (Nombre: ${existingCityByCoords.name}) ya existe. Se omite creación y se retorna la existente.`);
      const reloadedExisting = await this.cityRepository.findOne({ where: { id: existingCityByCoords.id }, relations: ['province', 'province.country'] });
      if (!reloadedExisting) throw new NotFoundException('Error al recargar ciudad existente.');
      return returnEntity ? reloadedExisting : this.mapToResponseDto(reloadedExisting);
    }

    const existingNominalCity = await this.cityRepository.findOne({
      where: { name: createCityDto.name, provinceId: createCityDto.provinceId }
    });
    if (existingNominalCity) {
      this.logger.warn(`Conflicto nominal: La ciudad '${createCityDto.name}' ya existe en la provincia '${province.name}' (pero con diferentes coordenadas).`);
    }

    const city = this.cityRepository.create({
      name: createCityDto.name,
      province: province,
      provinceId: province.id,
      latitude: createCityDto.latitude,
      longitude: createCityDto.longitude,
    });

    try {
      const savedCity = await this.cityRepository.save(city);
      this.logger.log(`Ciudad creada ID: ${savedCity.id}, Nombre: ${savedCity.name}, Lat: ${savedCity.latitude}, Lon: ${savedCity.longitude}`);
      const reloadedCity = await this.cityRepository.findOne({ where: { id: savedCity.id }, relations: ['province', 'province.country'] });
      if (!reloadedCity) throw new NotFoundException('No se pudo recargar la ciudad creada.');
      return returnEntity ? reloadedCity : this.mapToResponseDto(reloadedCity);
    } catch (error: any) {
      if (error.code === '23505') {
        this.logger.warn(`Conflicto de BD al guardar ciudad: ${error.detail}. Intentando encontrarla...`);
        const raceConditionCity = await this.cityRepository.findOne({
          where: { latitude: createCityDto.latitude, longitude: createCityDto.longitude },
          relations: ['province', 'province.country']
        });
        if (raceConditionCity) return returnEntity ? raceConditionCity : this.mapToResponseDto(raceConditionCity);
        throw new ConflictException(`La ubicación (lat/lon) para esta ciudad ya existe.`);
      }
      this.logger.error(`Error al guardar la ciudad: ${error.message}`, error.stack);
      throw error;
    }
  }

  // MODIFICADO: Añadido paginationDto
  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponseDto<CityResponseDto>> {
    const { page = 1, limit = 10, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const findOptions: FindManyOptions<City> = {
      relations: this.defaultRelations,
      skip: skip,
      take: limit,
    };

    if (sortBy) {
      const allowedSortFields = ['id', 'name', 'latitude', 'longitude', 'provinceId'];
      if (!allowedSortFields.includes(sortBy)) {
        throw new BadRequestException(`El campo de ordenamiento '${sortBy}' no es válido.`);
      }
      findOptions.order = { [sortBy]: sortOrder || 'ASC' };
    } else {
      findOptions.order = { id: 'ASC' };
    }

    const [cities, total] = await this.cityRepository.findAndCount(findOptions);
    const mappedCities = cities.map(city => this.mapToResponseDto(city));
    return new PaginatedResponseDto<CityResponseDto>(mappedCities, total, page, limit);
  }

  async findOne(id: number, loadOtherRelations: boolean = false, returnEntity: boolean = false): Promise<City | CityResponseDto> {
    this.logger.debug(`Buscando ciudad ID: ${id}`);
    const city = await this.cityRepository.findOne({
      where: { id },
      relations: ['province', 'province.country'], // Siempre carga para DTO
    });
    if (!city) {
      this.logger.warn(`Ciudad ID ${id} no encontrada.`);
      throw new NotFoundException(`Ciudad con ID ${id} no encontrada.`);
    }
    return returnEntity ? city : this.mapToResponseDto(city);
  }

  async findOneByNameAndProvinceName(cityName: string, provinceName: string, returnEntity: boolean = false): Promise<City | CityResponseDto | null> {
    this.logger.debug(`Buscando ciudad por nombre '${cityName}'${provinceName ? ` en provincia '${provinceName}'` : ''}`);

    const queryOptions: FindOptionsWhere<City> = {
      name: cityName,
    };

    if (provinceName) {
      const city = await this.cityRepository.findOne({
        where: {
          name: cityName,
          province: {
            name: provinceName,
          }
        },
        relations: ['province', 'province.country'],
      });
      return city ? (returnEntity ? city : this.mapToResponseDto(city)) : null;
    } else {
      const cities = await this.cityRepository.find({
        where: queryOptions,
        relations: ['province', 'province.country'],
      });
      if (cities.length > 1) {
        this.logger.warn(`Múltiples ciudades encontradas con el nombre '${cityName}'. Se recomienda especificar la provincia.`);
        return cities[0] ? (returnEntity ? cities[0] : this.mapToResponseDto(cities[0])) : null;
      }
      return cities.length > 0 ? (returnEntity ? cities[0] : this.mapToResponseDto(cities[0])) : null;
    }
  }

  async findOneByNameAndProvinceId(name: string, provinceId: number, loadOtherRelations: boolean = false, returnEntity: boolean = false): Promise<City | CityResponseDto | null> {
    this.logger.debug(`Buscando ciudad por nombre '${name}' y provinceId '${provinceId}'`);
    const city = await this.cityRepository.findOne({
      where: {
        name: name,
        provinceId: provinceId
      },
      relations: ['province', 'province.country'],
    });

    if (!city) {
      this.logger.log(`Ciudad con nombre '${name}' y provinceId '${provinceId}' no encontrada.`);
      return null;
    }
    return city ? (returnEntity ? city : this.mapToResponseDto(city)) : null;
  }

  // MODIFICADO: Añadido paginationDto
  async searchByName(term: string, paginationDto: PaginationDto): Promise<PaginatedResponseDto<CityResponseDto>> {
    this.logger.debug(`Buscando ciudades por término: ${term}`);
    if (!term || term.trim() === "") {
      throw new BadRequestException('El término de búsqueda no puede estar vacío.');
    }

    const { page = 1, limit = 10, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const findOptions: FindManyOptions<City> = {
      where: { name: ILike(`%${term}%`) },
      relations: this.defaultRelations,
      skip: skip,
      take: limit,
    };

    if (sortBy) {
      const allowedSortFields = ['id', 'name', 'latitude', 'longitude', 'provinceId'];
      if (!allowedSortFields.includes(sortBy)) {
        throw new BadRequestException(`El campo de ordenamiento '${sortBy}' no es válido.`);
      }
      findOptions.order = { [sortBy]: sortOrder || 'ASC' };
    } else {
      findOptions.order = { id: 'ASC' };
    }

    const [cities, total] = await this.cityRepository.findAndCount(findOptions);
    const mappedCities = cities.map(city => this.mapToResponseDto(city));
    return new PaginatedResponseDto<CityResponseDto>(mappedCities, total, page, limit);
  }

  async updatePut(id: number, updateDto: UpdatePutCityDto): Promise<CityResponseDto> {
    this.logger.debug(`Actualizando (PUT) ciudad ID: ${id}`);
    const cityToUpdate = await this.cityRepository.findOne({ where: { id }, relations: ['province', 'province.country'] });
    if (!cityToUpdate) throw new NotFoundException(`Ciudad con ID ${id} no encontrada.`);

    const province = await this.findProvinceById(updateDto.provinceId);

    if (updateDto.latitude !== cityToUpdate.latitude || updateDto.longitude !== cityToUpdate.longitude) {
      const existing = await this.cityRepository.findOne({
        where: { latitude: updateDto.latitude, longitude: updateDto.longitude, id: Not(id) }
      });
      if (existing) {
        throw new ConflictException(`La ubicación (latitud/longitud) ya está registrada para otra ciudad.`);
      }
    }
    if (updateDto.name !== cityToUpdate.name || updateDto.provinceId !== cityToUpdate.provinceId) {
      const existing = await this.cityRepository.findOne({
        where: { name: updateDto.name, provinceId: updateDto.provinceId, id: Not(id) }
      });
      if (existing) {
        throw new ConflictException(`La combinación de nombre '${updateDto.name}' y provincia ya existe para otra ciudad.`);
      }
    }

    cityToUpdate.name = updateDto.name;
    cityToUpdate.province = province;
    cityToUpdate.provinceId = province.id;
    cityToUpdate.latitude = updateDto.latitude;
    cityToUpdate.longitude = updateDto.longitude;

    const updatedCity = await this.cityRepository.save(cityToUpdate);
    this.logger.log(`Ciudad ID ${updatedCity.id} actualizada (PUT).`);
    const reloadedUpdated = await this.cityRepository.findOne({ where: { id: updatedCity.id }, relations: ['province', 'province.country'] });
    if (!reloadedUpdated) throw new NotFoundException('No se pudo recargar la ciudad actualizada.');
    return this.mapToResponseDto(reloadedUpdated);
  }

  async updatePatch(id: number, updateDto: UpdateCityDto): Promise<CityResponseDto> {
    this.logger.debug(`Actualizando (PATCH) ciudad ID: ${id}`);
    const cityToUpdate = await this.cityRepository.findOne({ where: { id }, relations: ['province', 'province.country'] });
    if (!cityToUpdate) {
      this.logger.warn(`Ciudad ID ${id} no encontrada para PATCH.`);
      throw new NotFoundException(`Ciudad con ID ${id} no encontrada.`);
    }

    let nameChanged = false;
    if (updateDto.name !== undefined && updateDto.name !== cityToUpdate.name) {
      cityToUpdate.name = updateDto.name;
      nameChanged = true;
    }
    let provinceChanged = false;
    if (updateDto.provinceId !== undefined && cityToUpdate.provinceId !== updateDto.provinceId) {
      const province = await this.findProvinceById(updateDto.provinceId);
      cityToUpdate.province = province;
      cityToUpdate.provinceId = province.id;
      provinceChanged = true;
    }
    let coordsChanged = false;
    if (updateDto.latitude !== undefined && updateDto.latitude !== cityToUpdate.latitude) {
      cityToUpdate.latitude = updateDto.latitude;
      coordsChanged = true;
    }
    if (updateDto.longitude !== undefined && updateDto.longitude !== cityToUpdate.longitude) {
      cityToUpdate.longitude = updateDto.longitude;
      coordsChanged = true;
    }

    if (coordsChanged) {
      const existing = await this.cityRepository.findOne({
        where: { latitude: cityToUpdate.latitude, longitude: cityToUpdate.longitude, id: Not(id) }
      });
      if (existing) {
        throw new ConflictException(`La ubicación (latitud/longitud) ya está registrada para otra ciudad.`);
      }
    }
    if ((nameChanged || provinceChanged) && !coordsChanged) {
      const existingNominal = await this.cityRepository.findOne({
        where: { name: cityToUpdate.name, provinceId: cityToUpdate.provinceId, id: Not(id) }
      });
      if (existingNominal) {
        throw new ConflictException(`La combinación de nombre '${cityToUpdate.name}' y provincia ya existe para otra ciudad.`);
      }
    }

    const updatedCity = await this.cityRepository.save(cityToUpdate);
    this.logger.log(`Ciudad ID ${updatedCity.id} actualizada (PATCH).`);
    const reloadedUpdated = await this.cityRepository.findOne({ where: { id: updatedCity.id }, relations: ['province', 'province.country'] });
    if (!reloadedUpdated) throw new NotFoundException('No se pudo recargar la ciudad actualizada.');
    return this.mapToResponseDto(reloadedUpdated);
  }

  async remove(id: number): Promise<{ message: string }> {
    this.logger.debug(`Eliminando ciudad ID: ${id}`);
    const city = await this.cityRepository.findOne({ where: { id }, relations: ['persons'] });
    if (!city) {
      this.logger.warn(`Ciudad ID ${id} no encontrada para eliminar.`);
      throw new NotFoundException(`Ciudad con ID ${id} no encontrada.`);
    }

    if (city.persons && city.persons.length > 0) {
      this.logger.warn(`No se puede eliminar la ciudad ID ${id} porque tiene personas asociadas.`);
      throw new ConflictException(`No se puede eliminar la ciudad '${city.name}' porque tiene personas asociadas. Reasigne las personas primero.`);
    }
    await this.cityRepository.remove(city);
    this.logger.log(`Ciudad ID: ${id} eliminada.`);
    return { message: `Ciudad con ID ${id} eliminada correctamente.` };
  }
}