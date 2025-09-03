// src/person/person.service.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not, FindManyOptions } from 'typeorm';
import { Person, PersonRole } from '../entities/person.entity';
import { CreatePersonDto } from '../dto/create-person.dto';
import { UpdatePatchPersonDto } from '../dto/update-patch-person.dto';
import { UpdatePutPersonDto } from '../dto/update-put-person.dto';
import { City } from '../entities/city.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';
import { PersonResponseDto, CityResponse, ProvinceResponse, CountryResponse } from '../interfaces/person.interfaces';


function adjustDateForTimezone(dateString: string | Date): Date | null {
  if (!dateString) return null;
  // Si ya es un objeto Date, no hacemos nada. Si es string, lo ajustamos.
  if (typeof dateString !== 'string') return dateString;
  // Creamos la fecha, que JS interpretará como UTC a medianoche.
  const date = new Date(dateString);
  // Obtenemos el desfase de la zona horaria del servidor en minutos (ej: para GMT-3 es 180).
  const timezoneOffset = date.getTimezoneOffset();
  // Añadimos ese desfase a la fecha para contrarrestar la conversión UTC y mantener el día correcto.
  return new Date(date.getTime() + (timezoneOffset * 60000));
}

@Injectable()
export class PersonService {
  private readonly logger = new Logger(PersonService.name);

  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
  ) { }

  private readonly defaultRelations = ['city', 'city.province', 'city.province.country'];

  private mapToResponseDto(person: Person): PersonResponseDto | null {
    if (!person) {
      return null;
    }

    let cityResponse: CityResponse | null = null;
    if (person.city) {
      let provinceResponse: ProvinceResponse | null = null;
      if (person.city.province) {
        let countryResponse: CountryResponse | null = null;
        if (person.city.province.country) {
          countryResponse = {
            id: person.city.province.country.id,
            name: person.city.province.country.name,
          };
        }
        provinceResponse = {
          id: person.city.province.id,
          name: person.city.province.name,
          country: countryResponse,
        };
      }
      cityResponse = {
        id: person.city.id,
        name: person.city.name,
        province: provinceResponse,
      };
    }

    return {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      birthDate: person.birthDate,
      role: person.role,
      city: cityResponse,
      cityId: person.cityId,
    };
  }

  async create(createPersonDto: CreatePersonDto): Promise<PersonResponseDto> {
    this.logger.debug(`Creando persona: ${createPersonDto.email}`);
    const { email, password, cityId, role, birthDate, firstName, lastName } = createPersonDto;

    const existingPerson = await this.personRepository.findOne({ where: { email } });
    if (existingPerson) {
      this.logger.warn(`Email '${email}' ya existe.`);
      throw new ConflictException(`El email '${email}' ya está en uso.`);
    }

    let cityEntity: City | null = null;
    if (cityId !== undefined && cityId !== null) {
      cityEntity = await this.cityRepository.findOne({ where: { id: cityId } });
      if (!cityEntity) {
        this.logger.warn(`Ciudad con ID ${cityId} no encontrada.`);
        throw new NotFoundException(`Ciudad con ID ${cityId} no encontrada.`);
      }
    }

    const newPersonEntity = this.personRepository.create({
      firstName,
      lastName,
      email,
      password,
      role: role || PersonRole.USER,
      city: cityEntity,
      cityId: cityEntity ? cityEntity.id : null,
      birthDate: birthDate ? adjustDateForTimezone(birthDate) : null,
    });

    const savedPerson = await this.personRepository.save(newPersonEntity);
    this.logger.log(`Persona creada con ID: ${savedPerson.id}`);
    const reloadedPerson = await this.personRepository.findOne({ where: { id: savedPerson.id }, relations: this.defaultRelations });

    if (!reloadedPerson) {
      this.logger.error(`Error crítico: No se pudo recargar la persona creada con ID ${savedPerson.id}`);
      throw new InternalServerErrorException('No se pudo recargar la persona creada.');
    }
    const responseDto = this.mapToResponseDto(reloadedPerson);
    if (!responseDto) {
      this.logger.error(`Error crítico: el mapeo de la persona con ID ${savedPerson.id} resultó en null.`);
      throw new InternalServerErrorException('Ocurrió un error al procesar la respuesta.');
    }
    return responseDto;
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponseDto<PersonResponseDto>> {
    const { page = 1, limit = 10, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const findOptions: FindManyOptions<Person> = {
      relations: this.defaultRelations,
      skip: skip,
      take: limit,
      order: sortBy ? { [sortBy]: sortOrder || 'ASC' } : { id: 'ASC' },
    };

    const [persons, total] = await this.personRepository.findAndCount(findOptions);

    const mappedPersons = persons
      .map(person => this.mapToResponseDto(person))
      .filter((p): p is PersonResponseDto => p !== null);

    return new PaginatedResponseDto<PersonResponseDto>(mappedPersons, total, page, limit);
  }

  async findOne(id: number, loadRelations: boolean = true): Promise<PersonResponseDto> {
    this.logger.debug(`Buscando persona ID: ${id}`);
    const person = await this.personRepository.findOne({
      where: { id },
      relations: loadRelations ? this.defaultRelations : [],
    });
    if (!person) {
      this.logger.warn(`Persona ID ${id} no encontrada.`);
      throw new NotFoundException(`Persona con ID ${id} no encontrada.`);
    }

    const responseDto = this.mapToResponseDto(person);
    if (!responseDto) {
      this.logger.error(`Error crítico: el mapeo de la persona con ID ${id} resultó en null.`);
      throw new InternalServerErrorException('Ocurrió un error al procesar la respuesta.');
    }
    return responseDto;
  }

  async findByEmailForAuth(email: string): Promise<Person | null> {
    this.logger.debug(`Buscando persona por email para auth: ${email}`);
    return this.personRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'role', 'firstName', 'lastName', 'cityId', 'birthDate']
    });
  }

  async update(id: number, updateDto: UpdatePatchPersonDto): Promise<PersonResponseDto> {
    this.logger.debug(`Actualizando (PATCH) persona ID: ${id}`);
    const personToUpdate = await this.personRepository.preload({
      id: id,
      ...updateDto
    });
    if (!personToUpdate) {
      throw new NotFoundException(`Persona con ID ${id} no encontrada.`);
    }

    Object.assign(personToUpdate, updateDto);
    const updatedPerson = await this.personRepository.save(personToUpdate);
    const reloadedPerson = await this.personRepository.findOne({ where: { id: updatedPerson.id }, relations: this.defaultRelations });

    if (!reloadedPerson) {
      throw new InternalServerErrorException('No se pudo recargar la persona actualizada.');
    }
    const responseDto = this.mapToResponseDto(reloadedPerson);
    if (!responseDto) {
      throw new InternalServerErrorException('Ocurrió un error al procesar la respuesta de actualización.');
    }
    return responseDto;
  }

  async updatePut(id: number, updateDto: UpdatePutPersonDto): Promise<PersonResponseDto> {
    this.logger.debug(`Actualizando (PUT) persona ID: ${id}`);
    let person = await this.personRepository.findOneBy({ id });
    if (!person) {
      throw new NotFoundException(`Persona con ID ${id} no encontrada.`);
    }

    Object.assign(person, updateDto);
    const updatedPerson = await this.personRepository.save(person);
    const reloadedPerson = await this.personRepository.findOne({ where: { id: updatedPerson.id }, relations: this.defaultRelations });

    if (!reloadedPerson) {
      throw new InternalServerErrorException('No se pudo recargar la persona actualizada.');
    }
    const responseDto = this.mapToResponseDto(reloadedPerson);
    if (!responseDto) {
      throw new InternalServerErrorException('Ocurrió un error al procesar la respuesta de actualización.');
    }
    return responseDto;
  }

  async remove(id: number): Promise<{ message: string }> {
    this.logger.debug(`Eliminando persona ID: ${id}`);
    const result = await this.personRepository.delete(id);
    if (result.affected === 0) {
      this.logger.warn(`Persona ID ${id} no encontrada para eliminar.`);
      throw new NotFoundException(`Persona con ID ${id} no encontrada.`);
    }
    this.logger.log(`Persona ID: ${id} eliminada.`);
    return { message: `Persona con ID ${id} eliminada correctamente.` };
  }

  async findByName(nameQuery: string, paginationDto: PaginationDto): Promise<PaginatedResponseDto<PersonResponseDto>> {
    const { page = 1, limit = 10, sortBy, sortOrder } = paginationDto;
    const findOptions: FindManyOptions<Person> = {
      where: [
        { firstName: ILike(`%${nameQuery}%`) },
        { lastName: ILike(`%${nameQuery}%`) },
      ],
      relations: this.defaultRelations,
      skip: (page - 1) * limit,
      take: limit,
      order: sortBy ? { [sortBy]: sortOrder || 'ASC' } : { id: 'ASC' },
    };

    const [persons, total] = await this.personRepository.findAndCount(findOptions);

    const mappedPersons = persons
      .map(person => this.mapToResponseDto(person))
      .filter((p): p is PersonResponseDto => p !== null);

    return new PaginatedResponseDto<PersonResponseDto>(mappedPersons, total, page, limit);
  }
}