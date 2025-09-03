// src/province/province.service.ts
import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not, FindManyOptions } from 'typeorm';
import { Province } from '../entities/province.entity';
import { Country } from '../entities/country.entity';
import { CreateProvinceDto } from '../dto/create-province.dto';
import { UpdateProvinceDto } from '../dto/update-patch-province.dto';
import { UpdatePutProvinceDto } from '../dto/update-put-province.dto';
import { ProvinceResponseDto } from '../interfaces/province.interfaces';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

@Injectable()
export class ProvincesService {
  private readonly logger = new Logger(ProvincesService.name);

  constructor(
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) { }

  private readonly defaultRelations = ['country'];

  private async findCountryById(countryId: number): Promise<Country> {
    this.logger.debug(`Buscando país ID: ${countryId}`);
    const country = await this.countryRepository.findOne({ where: { id: countryId } });
    if (!country) {
      this.logger.warn(`País ID ${countryId} no encontrado.`);
      throw new NotFoundException(`País con ID ${countryId} no encontrado.`);
    }
    return country;
  }

  async findByCountry(countryId: number): Promise<PaginatedResponseDto<ProvinceResponseDto>> {
    this.logger.log(`Buscando todas las PROVINCIAS para el país con ID: ${countryId}`);

    // Usamos el repositorio para encontrar las entidades de Provincia
    const [provinces, total] = await this.provinceRepository.findAndCount({
      where: {
        // Filtramos las PROVINCIAS por el ID de su país relacionado
        country: { id: countryId }
      },
      order: { name: 'ASC' }
    });

    // Devolvemos la LISTA DE PROVINCIAS en el formato paginado que espera el frontend
    return new PaginatedResponseDto(provinces, total, 1, total);
  }

  private mapToResponseDto(province: Province): ProvinceResponseDto {
    if (!province.country) {
      this.logger.error(`Provincia ID ${province.id} sin relación 'country' cargada para DTO.`);
      throw new Error('La relación de país no está cargada para la provincia.');
    }
    return {
      id: province.id,
      name: province.name,
      latitude: province.latitude,
      longitude: province.longitude,
      country: {
        id: province.country.id,
        name: province.country.name,
      },
    };
  }

  async create(createProvinceDto: CreateProvinceDto, returnEntity: boolean = false): Promise<Province | ProvinceResponseDto> {
    this.logger.debug(`Creando provincia: ${createProvinceDto.name}, Lat: ${createProvinceDto.latitude}, Lon: ${createProvinceDto.longitude}`);
    const country = await this.findCountryById(createProvinceDto.countryId);

    const existingByCoords = await this.provinceRepository.findOne({
      where: { latitude: createProvinceDto.latitude, longitude: createProvinceDto.longitude }
    });
    if (existingByCoords) {
      this.logger.log(`Provincia en Lat: ${createProvinceDto.latitude}, Lon: ${createProvinceDto.longitude} (Nombre: ${existingByCoords.name}) ya existe. Retornando existente.`);
      const reloadedExisting = await this.provinceRepository.findOne({ where: { id: existingByCoords.id }, relations: ['country'] });
      if (!reloadedExisting) throw new NotFoundException('Error al recargar provincia existente.');
      return returnEntity ? reloadedExisting : this.mapToResponseDto(reloadedExisting);
    }

    const existingNominal = await this.provinceRepository.findOne({
      where: { name: createProvinceDto.name, countryId: createProvinceDto.countryId }
    });
    if (existingNominal) {
      this.logger.warn(`Conflicto nominal: Provincia '${createProvinceDto.name}' ya existe en país '${country.name}' (coords difieren).`);
    }

    const province = this.provinceRepository.create({
      name: createProvinceDto.name,
      country,
      countryId: country.id,
      latitude: createProvinceDto.latitude,
      longitude: createProvinceDto.longitude,
    });

    try {
      const savedProvince = await this.provinceRepository.save(province);
      this.logger.log(`Provincia '${savedProvince.name}' creada ID: ${savedProvince.id}`);
      const reloadedProvince = await this.provinceRepository.findOne({ where: { id: savedProvince.id }, relations: ['country'] });
      if (!reloadedProvince) throw new NotFoundException('Error al recargar la provincia creada.');
      return returnEntity ? reloadedProvince : this.mapToResponseDto(reloadedProvince);
    } catch (error: any) {
      if (error.code === '23505') {
        this.logger.warn(`Conflicto BD al guardar provincia: ${error.detail}. Buscando de nuevo...`);
        const raceCondition = await this.provinceRepository.findOne({
          where: { latitude: createProvinceDto.latitude, longitude: createProvinceDto.longitude },
          relations: ['country']
        });
        if (raceCondition) return returnEntity ? raceCondition : this.mapToResponseDto(raceCondition);
        throw new ConflictException(`Ubicación (lat/lon) para esta provincia ya existe.`);
      }
      this.logger.error(`Error al guardar provincia: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponseDto<ProvinceResponseDto>> {
    const { page = 1, limit = 10, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const findOptions: FindManyOptions<Province> = {
      relations: ['country'], // Solo carga 'country'
      skip: skip,
      take: limit,
    };

    if (sortBy) {
      const allowedSortFields = ['id', 'name', 'latitude', 'longitude', 'countryId'];
      if (!allowedSortFields.includes(sortBy)) {
        throw new BadRequestException(`El campo de ordenamiento '${sortBy}' no es válido.`);
      }
      findOptions.order = { [sortBy]: sortOrder || 'ASC' };
    } else {
      findOptions.order = { id: 'ASC' };
    }

    const [provinces, total] = await this.provinceRepository.findAndCount(findOptions);
    const mappedProvinces = provinces.map(province => this.mapToResponseDto(province));
    return new PaginatedResponseDto<ProvinceResponseDto>(mappedProvinces, total, page, limit);
  }

  async findOne(id: number, loadOtherRelations: boolean = false, returnEntity: boolean = false): Promise<Province | ProvinceResponseDto> {
    this.logger.debug(`Buscando provincia ID: ${id}`);
    const province = await this.provinceRepository.findOne({
      where: { id },
      relations: ['country'], // Solo carga 'country'
    });
    if (!province) {
      this.logger.warn(`Provincia ID ${id} no encontrada.`);
      throw new NotFoundException(`Provincia con ID ${id} no encontrada.`);
    }
    return returnEntity ? province : this.mapToResponseDto(province);
  }

  async findOneByNameAndCountryId(name: string, countryId: number, loadOtherRelations: boolean = false, returnEntity: boolean = false): Promise<Province | ProvinceResponseDto | null> {
    this.logger.debug(`Buscando provincia: ${name}, país ID: ${countryId}`);
    const province = await this.provinceRepository.findOne({
      where: { name, countryId },
      relations: ['country'], // Solo carga 'country'
    });
    return province ? (returnEntity ? province : this.mapToResponseDto(province)) : null;
  }

  async searchByName(term: string, paginationDto: PaginationDto): Promise<PaginatedResponseDto<ProvinceResponseDto>> {
    this.logger.debug(`Buscando provincias por término: ${term}`);
    if (!term || term.trim() === "") {
      throw new BadRequestException('El término de búsqueda no puede estar vacío.');
    }

    const { page = 1, limit = 10, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const findOptions: FindManyOptions<Province> = {
      where: { name: ILike(`%${term}%`) },
      relations: ['country'], // Solo carga 'country'
      skip: skip,
      take: limit,
    };

    if (sortBy) {
      const allowedSortFields = ['id', 'name', 'latitude', 'longitude', 'countryId'];
      if (!allowedSortFields.includes(sortBy)) {
        throw new BadRequestException(`El campo de ordenamiento '${sortBy}' no es válido.`);
      }
      findOptions.order = { [sortBy]: sortOrder || 'ASC' };
    } else {
      findOptions.order = { id: 'ASC' };
    }

    const [provinces, total] = await this.provinceRepository.findAndCount(findOptions);
    const mappedProvinces = provinces.map(province => this.mapToResponseDto(province));
    return new PaginatedResponseDto<ProvinceResponseDto>(mappedProvinces, total, page, limit);
  }

  async updatePut(id: number, updateDto: UpdatePutProvinceDto): Promise<ProvinceResponseDto> {
    this.logger.debug(`Actualizando (PUT) provincia ID: ${id}`);
    const provinceToUpdate = await this.provinceRepository.findOne({ where: { id }, relations: ['country'] });
    if (!provinceToUpdate) throw new NotFoundException(`Provincia con ID ${id} no encontrada.`);

    const country = await this.findCountryById(updateDto.countryId);

    if (updateDto.latitude !== provinceToUpdate.latitude || updateDto.longitude !== provinceToUpdate.longitude) {
      const existing = await this.provinceRepository.findOne({
        where: { latitude: updateDto.latitude, longitude: updateDto.longitude, id: Not(id) }
      });
      if (existing) throw new ConflictException(`Ubicación (lat/lon) ya registrada para otra provincia.`);
    }
    if (updateDto.name !== provinceToUpdate.name || updateDto.countryId !== provinceToUpdate.countryId) {
      const existing = await this.provinceRepository.findOne({
        where: { name: updateDto.name, countryId: updateDto.countryId, id: Not(id) }
      });
      if (existing) throw new ConflictException(`Provincia '${updateDto.name}' ya existe en el país.`);
    }

    provinceToUpdate.name = updateDto.name;
    provinceToUpdate.country = country;
    provinceToUpdate.countryId = country.id;
    provinceToUpdate.latitude = updateDto.latitude;
    provinceToUpdate.longitude = updateDto.longitude;

    const updated = await this.provinceRepository.save(provinceToUpdate);
    this.logger.log(`Provincia ID ${updated.id} actualizada (PUT).`);
    const reloadedUpdated = await this.provinceRepository.findOne({ where: { id: updated.id }, relations: ['country'] });
    if (!reloadedUpdated) throw new NotFoundException('Error al recargar la provincia actualizada.');
    return this.mapToResponseDto(reloadedUpdated);
  }

  async updatePatch(id: number, updateDto: UpdateProvinceDto): Promise<ProvinceResponseDto> {
    this.logger.debug(`Actualizando (PATCH) provincia ID: ${id}`);
    const provinceToUpdate = await this.provinceRepository.findOne({ where: { id }, relations: ['country'] });
    if (!provinceToUpdate) {
      this.logger.warn(`Provincia ID ${id} no encontrada para PATCH.`);
      throw new NotFoundException(`Provincia con ID ${id} no encontrada.`);
    }

    let nameChanged = false, countryChanged = false, coordsChanged = false;
    if (updateDto.name !== undefined) { provinceToUpdate.name = updateDto.name; nameChanged = true; }
    if (updateDto.countryId !== undefined && provinceToUpdate.countryId !== updateDto.countryId) {
      const country = await this.findCountryById(updateDto.countryId);
      provinceToUpdate.country = country;
      provinceToUpdate.countryId = country.id;
      countryChanged = true;
    }
    if (updateDto.latitude !== undefined) { provinceToUpdate.latitude = updateDto.latitude; coordsChanged = true; }
    if (updateDto.longitude !== undefined) { provinceToUpdate.longitude = updateDto.longitude; coordsChanged = true; }

    if (coordsChanged) {
      const existing = await this.provinceRepository.findOne({
        where: { latitude: provinceToUpdate.latitude, longitude: provinceToUpdate.longitude, id: Not(id) }
      });
      if (existing) throw new ConflictException(`Ubicación (lat/lon) ya registrada para otra provincia.`);
    }
    if ((nameChanged || countryChanged) && !coordsChanged) {
      const existing = await this.provinceRepository.findOne({
        where: { name: provinceToUpdate.name, countryId: provinceToUpdate.countryId, id: Not(id) }
      });
      if (existing) throw new ConflictException(`Provincia '${provinceToUpdate.name}' ya existe en el país.`);
    }

    const updated = await this.provinceRepository.save(provinceToUpdate);
    this.logger.log(`Provincia ID ${updated.id} actualizada (PATCH).`);
    const reloadedUpdated = await this.provinceRepository.findOne({ where: { id: updated.id }, relations: ['country'] });
    if (!reloadedUpdated) throw new NotFoundException('Error al recargar la provincia actualizada.');
    return this.mapToResponseDto(reloadedUpdated);
  }

  async remove(id: number): Promise<{ message: string }> {
    this.logger.debug(`Eliminando provincia ID: ${id}`);
    const province = await this.provinceRepository.findOne({ where: { id }, relations: ['cities'] });
    if (!province) {
      this.logger.warn(`Provincia ID ${id} no encontrada para eliminar.`);
      throw new NotFoundException(`Provincia con ID ${id} no encontrada.`);
    }

    if (province.cities && province.cities.length > 0) {
      this.logger.warn(`No se puede eliminar provincia ID ${id}, tiene ciudades asociadas.`);
      throw new ConflictException(`No se puede eliminar provincia '${province.name}', tiene ciudades asociadas.`);
    }
    await this.provinceRepository.remove(province);
    this.logger.log(`Provincia ID: ${id} eliminada.`);
    return { message: `Provincia con ID ${id} eliminada correctamente.` };
  }
}