// src/country/country.service.ts
import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not, FindManyOptions } from 'typeorm';
import { Country } from '../entities/country.entity';
import { CreateCountryDto } from '../dto/create-country.dto';
import { UpdateCountryDto } from '../dto/update-patch-country.dto';
import { UpdatePutCountryDto } from '../dto/update-put-country.dto';
import { CountryResponseDto } from '../interfaces/country.interfaces';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

@Injectable()
export class CountriesService {
  private readonly logger = new Logger(CountriesService.name);

  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) { }

  private readonly defaultRelations = ['provinces'];

  private mapToResponseDto(country: Country): CountryResponseDto {
    return {
      id: country.id,
      name: country.name,
      code: country.code,
    };
  }

  async create(createCountryDto: CreateCountryDto, returnEntity: boolean = false): Promise<Country | CountryResponseDto> {
    this.logger.debug(`Creando país: ${createCountryDto.name}`);
    const { name, code } = createCountryDto;

    const existingByName = await this.countryRepository.findOne({ where: { name } });
    if (existingByName) {
      this.logger.warn(`País con nombre '${name}' ya existe.`);
      const reloadedExisting = await this.countryRepository.findOne({ where: { id: existingByName.id } });
      if (!reloadedExisting) throw new NotFoundException('Error al recargar país existente después de conflicto.');
      return returnEntity ? reloadedExisting : this.mapToResponseDto(reloadedExisting);
    }
    if (code) {
      const existingByCode = await this.countryRepository.findOne({ where: { code } });
      if (existingByCode) {
        this.logger.warn(`País con código '${code}' ya existe.`);
        const reloadedExisting = await this.countryRepository.findOne({ where: { id: existingByCode.id } });
        if (!reloadedExisting) throw new NotFoundException('Error al recargar país existente después de conflicto.');
        return returnEntity ? reloadedExisting : this.mapToResponseDto(reloadedExisting);
      }
    }

    const country = this.countryRepository.create({ name, code });
    const savedCountry = await this.countryRepository.save(country);
    this.logger.log(`País creado ID: ${savedCountry.id}`);
    return returnEntity ? savedCountry : this.mapToResponseDto(savedCountry);
  }

  async findAll(loadRelations: boolean = false, paginationDto: PaginationDto): Promise<PaginatedResponseDto<CountryResponseDto>> {
    const { page = 1, limit = 10, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const findOptions: FindManyOptions<Country> = {
      relations: loadRelations ? this.defaultRelations : [],
      skip: skip,
      take: limit,
    };

    if (sortBy) {
      const allowedSortFields = ['id', 'name', 'code'];
      if (!allowedSortFields.includes(sortBy)) {
        throw new BadRequestException(`El campo de ordenamiento '${sortBy}' no es válido.`);
      }
      findOptions.order = { [sortBy]: sortOrder || 'ASC' };
    } else {
      findOptions.order = { id: 'ASC' };
    }

    const [countries, total] = await this.countryRepository.findAndCount(findOptions);
    const mappedCountries = countries.map(country => this.mapToResponseDto(country));
    return new PaginatedResponseDto<CountryResponseDto>(mappedCountries, total, page, limit);
  }

  async findOne(id: number, loadRelations: boolean = false, returnEntity: boolean = false): Promise<Country | CountryResponseDto> {
    this.logger.debug(`Buscando país ID: ${id}`);
    const country = await this.countryRepository.findOne({
      where: { id },
      relations: loadRelations ? this.defaultRelations : [],
    });
    if (!country) {
      this.logger.warn(`País ID ${id} no encontrado.`);
      throw new NotFoundException(`País con ID ${id} no encontrado.`);
    }
    return returnEntity ? country : this.mapToResponseDto(country);
  }

  async findOneByName(name: string, loadRelations: boolean = false, returnEntity: boolean = false): Promise<Country | CountryResponseDto | null> {
    this.logger.debug(`Buscando país por nombre: ${name}`);
    const country = await this.countryRepository.findOne({
      where: { name },
      relations: loadRelations ? this.defaultRelations : [],
    });
    return country ? (returnEntity ? country : this.mapToResponseDto(country)) : null;
  }

  async searchByName(term: string, loadRelations: boolean = false, paginationDto: PaginationDto): Promise<PaginatedResponseDto<CountryResponseDto>> {
    this.logger.debug(`Buscando países por término: ${term}`);
    if (!term || term.trim() === "") {
      throw new BadRequestException('El término de búsqueda no puede estar vacío.');
    }

    const { page = 1, limit = 10, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const findOptions: FindManyOptions<Country> = {
      where: { name: ILike(`%${term}%`) },
      relations: loadRelations ? this.defaultRelations : [],
      skip: skip,
      take: limit,
    };

    if (sortBy) {
      const allowedSortFields = ['id', 'name', 'code'];
      if (!allowedSortFields.includes(sortBy)) {
        throw new BadRequestException(`El campo de ordenamiento '${sortBy}' no es válido.`);
      }
      findOptions.order = { [sortBy]: sortOrder || 'ASC' };
    } else {
      findOptions.order = { id: 'ASC' };
    }

    const [countries, total] = await this.countryRepository.findAndCount(findOptions);
    const mappedCountries = countries.map(country => this.mapToResponseDto(country));
    return new PaginatedResponseDto<CountryResponseDto>(mappedCountries, total, page, limit);
  }

  async updatePut(id: number, updateDto: UpdatePutCountryDto): Promise<CountryResponseDto> {
    this.logger.debug(`Actualizando (PUT) país ID: ${id}`);
    const entityToUpdate = await this.countryRepository.findOne({ where: { id } });
    if (!entityToUpdate) throw new NotFoundException(`País con ID ${id} no encontrado para actualizar.`);

    const { name, code } = updateDto;

    if (name !== entityToUpdate.name) {
      const existing = await this.countryRepository.findOne({ where: { name, id: Not(id) } });
      if (existing) throw new ConflictException(`País con nombre '${name}' ya existe.`);
    }
    if (code && code !== entityToUpdate.code) {
      const existing = await this.countryRepository.findOne({ where: { code, id: Not(id) } });
      if (existing) throw new ConflictException(`País con código '${code}' ya existe.`);
    }

    entityToUpdate.name = name;
    entityToUpdate.code = code === undefined ? entityToUpdate.code : code;

    const updatedCountry = await this.countryRepository.save(entityToUpdate);
    this.logger.log(`País ID ${updatedCountry.id} actualizado (PUT).`);
    return this.mapToResponseDto(updatedCountry);
  }

  async updatePatch(id: number, updateDto: UpdateCountryDto): Promise<CountryResponseDto> {
    this.logger.debug(`Actualizando (PATCH) país ID: ${id}`);
    const countryToUpdate = await this.countryRepository.preload({ id, ...updateDto });
    if (!countryToUpdate) {
      this.logger.warn(`País ID ${id} no encontrado para PATCH.`);
      throw new NotFoundException(`País con ID ${id} no encontrado.`);
    }

    if (updateDto.name && updateDto.name !== countryToUpdate.name) {
      const existing = await this.countryRepository.findOne({ where: { name: updateDto.name, id: Not(id) } });
      if (existing) throw new ConflictException(`País con nombre '${updateDto.name}' ya existe.`);
    }
    if (updateDto.code && updateDto.code !== countryToUpdate.code) {
      const existing = await this.countryRepository.findOne({ where: { code: updateDto.code, id: Not(id) } });
      if (existing) throw new ConflictException(`País con código '${updateDto.code}' ya existe.`);
    }

    const updatedCountry = await this.countryRepository.save(countryToUpdate);
    this.logger.log(`País ID ${updatedCountry.id} actualizado (PATCH).`);
    return this.mapToResponseDto(updatedCountry);
  }

  async remove(id: number): Promise<{ message: string }> {
    this.logger.debug(`Eliminando país ID: ${id}`);
    const country = await this.countryRepository.findOne({ where: { id }, relations: ['provinces'] });
    if (!country) {
      this.logger.warn(`País ID ${id} no encontrado para eliminar.`);
      throw new NotFoundException(`País con ID ${id} no encontrado.`);
    }

    if (country.provinces && country.provinces.length > 0) {
      this.logger.warn(`No se puede eliminar país ID ${id}, tiene provincias asociadas.`);
      throw new ConflictException(`No se puede eliminar el país '${country.name}' porque tiene provincias asociadas.`);
    }
    await this.countryRepository.remove(country);
    this.logger.log(`País ID: ${id} eliminado.`);
    return { message: `País con ID ${id} eliminado correctamente.` };
  }
}