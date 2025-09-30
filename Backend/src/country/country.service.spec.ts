//src\country\country.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Not, ILike } from 'typeorm';
import { CountriesService } from './country.service';
import { Country } from '../entities/country.entity';
import { CreateCountryDto } from '../dto/create-country.dto';
import { UpdateCountryDto } from '../dto/update-patch-country.dto';
import { UpdatePutCountryDto } from '../dto/update-put-country.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('CountriesService', () => {
  let service: CountriesService;
  let countryRepository: Repository<Country>;

  const mockCountryRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    preload: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CountriesService,
      {
        provide: getRepositoryToken(Country),
        useValue: mockCountryRepository,
      },
    ],
  }).compile();

  service = module.get<CountriesService>(CountriesService);
  countryRepository = module.get<Repository<Country>>(getRepositoryToken(Country));

  jest.resetAllMocks();
});

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateCountryDto = { name: 'Argentina', code: 'AR' };
    const mockCountry: Country = { id: 1, name: 'Argentina', code: 'AR', provinces: [] };

    it('should create a new country successfully', async () => {
      mockCountryRepository.findOne.mockResolvedValue(null);
      mockCountryRepository.create.mockReturnValue(mockCountry);
      mockCountryRepository.save.mockResolvedValue(mockCountry);

      const result = await service.create(createDto);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({ where: { name: 'Argentina' } });
      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({ where: { code: 'AR' } });
      expect(mockCountryRepository.create).toHaveBeenCalledWith({ name: 'Argentina', code: 'AR' });
      expect(mockCountryRepository.save).toHaveBeenCalledWith(mockCountry);
      expect(result).toEqual({ id: 1, name: 'Argentina', code: 'AR' });
    });

    it('should return existing country if name already exists', async () => {
      const existingCountry: Country = { id: 2, name: 'Argentina', code: 'ARG', provinces: [] };
      mockCountryRepository.findOne.mockResolvedValue(existingCountry);
      mockCountryRepository.findOne.mockResolvedValueOnce(existingCountry); // for name check

      const result = await service.create(createDto);

      expect(result).toEqual({ id: 2, name: 'Argentina', code: 'ARG' });
    });

    it('should return existing country if code already exists', async () => {
      const existingCountry: Country = { id: 2, name: 'Argentina', code: 'AR', provinces: [] };
      mockCountryRepository.findOne.mockResolvedValueOnce(null); // name not found
      mockCountryRepository.findOne.mockResolvedValueOnce(existingCountry); // code found
      mockCountryRepository.findOne.mockResolvedValueOnce(existingCountry); // reload existing

      const result = await service.create(createDto);

      expect(result).toEqual({ id: 2, name: 'Argentina', code: 'AR' });
    });

    it('should create country without code', async () => {
      const dtoWithoutCode: CreateCountryDto = { name: 'Argentina' };
      const countryWithoutCode: Country = { id: 1, name: 'Argentina', code: null, provinces: [] };

      mockCountryRepository.findOne.mockResolvedValue(null);
      mockCountryRepository.create.mockReturnValue(countryWithoutCode);
      mockCountryRepository.save.mockResolvedValue(countryWithoutCode);

      const result = await service.create(dtoWithoutCode);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({ where: { name: 'Argentina' } });
      expect(mockCountryRepository.findOne).not.toHaveBeenCalledWith({ where: { code: undefined } });
      expect(result).toEqual({ id: 1, name: 'Argentina', code: null });
    });

    it('should return entity when returnEntity is true', async () => {
      mockCountryRepository.findOne.mockResolvedValue(null);
      mockCountryRepository.create.mockReturnValue(mockCountry);
      mockCountryRepository.save.mockResolvedValue(mockCountry);

      const result = await service.create(createDto, true);

      expect(result).toBe(mockCountry);
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10, sortBy: 'name', sortOrder: 'ASC' };
    const mockCountries: Country[] = [
      { id: 1, name: 'Argentina', code: 'AR', provinces: [] },
      { id: 2, name: 'Brazil', code: 'BR', provinces: [] },
    ];

    it('should return paginated countries', async () => {
      mockCountryRepository.findAndCount.mockResolvedValue([mockCountries, 2]);

      const result = await service.findAll(false, paginationDto);

      expect(mockCountryRepository.findAndCount).toHaveBeenCalledWith({
        relations: [],
        skip: 0,
        take: 10,
        order: { name: 'ASC' },
      });
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.data).toHaveLength(2);
      expect(result.meta.totalItems).toBe(2);
    });

    it('should load relations when loadRelations is true', async () => {
      mockCountryRepository.findAndCount.mockResolvedValue([mockCountries, 2]);

      await service.findAll(true, paginationDto);

      expect(mockCountryRepository.findAndCount).toHaveBeenCalledWith({
        relations: ['provinces'],
        skip: 0,
        take: 10,
        order: { name: 'ASC' },
      });
    });

    it('should use default sorting when sortBy is not provided', async () => {
      const dtoWithoutSort: PaginationDto = { page: 1, limit: 10 };
      mockCountryRepository.findAndCount.mockResolvedValue([mockCountries, 2]);

      await service.findAll(false, dtoWithoutSort);

      expect(mockCountryRepository.findAndCount).toHaveBeenCalledWith({
        relations: [],
        skip: 0,
        take: 10,
        order: { id: 'ASC' },
      });
    });

    it('should throw BadRequestException for invalid sortBy', async () => {
      const invalidSortDto: PaginationDto = { page: 1, limit: 10, sortBy: 'invalid' };

      await expect(service.findAll(false, invalidSortDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    const mockCountry: Country = { id: 1, name: 'Argentina', code: 'AR', provinces: [] };

    it('should return country when found', async () => {
      mockCountryRepository.findOne.mockResolvedValue(mockCountry);

      const result = await service.findOne(1);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: [],
      });
      expect(result).toEqual({ id: 1, name: 'Argentina', code: 'AR' });
    });

    it('should load relations when loadRelations is true', async () => {
      mockCountryRepository.findOne.mockResolvedValue(mockCountry);

      await service.findOne(1, true);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['provinces'],
      });
    });

    it('should return entity when returnEntity is true', async () => {
      mockCountryRepository.findOne.mockResolvedValue(mockCountry);

      const result = await service.findOne(1, false, true);

      expect(result).toBe(mockCountry);
    });

    it('should throw NotFoundException when country not found', async () => {
      mockCountryRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByName', () => {
    const mockCountry: Country = { id: 1, name: 'Argentina', code: 'AR', provinces: [] };

    it('should return country when found', async () => {
      mockCountryRepository.findOne.mockResolvedValue(mockCountry);

      const result = await service.findOneByName('Argentina');

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'Argentina' },
        relations: [],
      });
      expect(result).toEqual({ id: 1, name: 'Argentina', code: 'AR' });
    });

    it('should return null when country not found', async () => {
      mockCountryRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneByName('NonExistent');

      expect(result).toBeNull();
    });

    it('should load relations when loadRelations is true', async () => {
      mockCountryRepository.findOne.mockResolvedValue(mockCountry);

      await service.findOneByName('Argentina', true);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'Argentina' },
        relations: ['provinces'],
      });
    });

    it('should return entity when returnEntity is true', async () => {
      mockCountryRepository.findOne.mockResolvedValue(mockCountry);

      const result = await service.findOneByName('Argentina', false, true);

      expect(result).toBe(mockCountry);
    });
  });

  describe('searchByName', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10 };
    const mockCountries: Country[] = [
      { id: 1, name: 'Argentina', code: 'AR', provinces: [] },
    ];

    it('should search countries by name', async () => {
      mockCountryRepository.findAndCount.mockResolvedValue([mockCountries, 1]);

      const result = await service.searchByName('Arg', false, paginationDto);

      expect(mockCountryRepository.findAndCount).toHaveBeenCalledWith({
        where: { name: ILike('%Arg%') },
        relations: [],
        skip: 0,
        take: 10,
        order: { id: 'ASC' },
      });
      expect(result).toBeInstanceOf(PaginatedResponseDto);
    });

    it('should throw BadRequestException for empty search term', async () => {
      await expect(service.searchByName('', false, paginationDto)).rejects.toThrow(BadRequestException);
      await expect(service.searchByName('   ', false, paginationDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePut', () => {
    const updateDto: UpdatePutCountryDto = { name: 'Argentina Updated', code: 'ARG' };
    const existingCountry: Country = { id: 1, name: 'Argentina', code: 'AR', provinces: [] };
    const updatedCountry: Country = { id: 1, name: 'Argentina Updated', code: 'ARG', provinces: [] };

    it('should update country successfully', async () => {
      mockCountryRepository.findOne.mockResolvedValueOnce(existingCountry); // find existing country
      mockCountryRepository.findOne.mockResolvedValueOnce(null); // name check passes
      mockCountryRepository.findOne.mockResolvedValueOnce(null); // code check passes
      mockCountryRepository.save.mockResolvedValue(updatedCountry);

      const result = await service.updatePut(1, updateDto);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockCountryRepository.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, name: 'Argentina Updated', code: 'ARG' });
    });

    it('should throw NotFoundException when country not found', async () => {
      // La primera llamada a findOne no encuentra el país
      mockCountryRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.updatePut(999, updateDto)).rejects.toThrow(NotFoundException);
      // Nos aseguramos de que `save` no se llame
      expect(mockCountryRepository.save).not.toHaveBeenCalled();
    });

  });

  describe('updatePatch', () => {
    const updateDto: UpdateCountryDto = { name: 'Argentina Updated' };
    const existingCountry: Country = { id: 1, name: 'Argentina', code: 'AR', provinces: [] };
    const updatedCountry: Country = { id: 1, name: 'Argentina Updated', code: 'AR', provinces: [] };

    it('should patch country successfully', async () => {
      // 1. La primera llamada a findOne busca el país original. Lo encuentra.
      mockCountryRepository.findOne.mockResolvedValueOnce(existingCountry);
      // 2. La segunda llamada (comprobación de conflicto de nombre) no encuentra nada.
      mockCountryRepository.findOne.mockResolvedValueOnce(null);
      // 3. Preload y save funcionan correctamente.
      mockCountryRepository.preload.mockResolvedValue(updatedCountry);
      mockCountryRepository.save.mockResolvedValue(updatedCountry);

      const result = await service.updatePatch(1, updateDto);

      expect(mockCountryRepository.preload).toHaveBeenCalledWith({ id: 1, ...updateDto });
      expect(mockCountryRepository.save).toHaveBeenCalledWith(updatedCountry);
      expect(result).toEqual({ id: 1, name: 'Argentina Updated', code: 'AR' });
    });

    it('should throw NotFoundException when country not found', async () => {
      // La primera llamada a findOne para encontrar el país original devuelve null.
      mockCountryRepository.findOne.mockResolvedValueOnce(null);
      // No necesitamos mockear preload porque el servicio lanzará la excepción antes.

      await expect(service.updatePatch(999, updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when name already exists', async () => {
      const conflictingCountry: Country = { id: 2, name: 'Argentina Updated', code: 'BR', provinces: [] };
    
      // 1. La primera llamada a findOne busca el país original. Lo encuentra.
      mockCountryRepository.findOne.mockResolvedValueOnce(existingCountry);
      // 2. La segunda llamada (comprobación de conflicto de nombre) encuentra otro país.
      mockCountryRepository.findOne.mockResolvedValueOnce(conflictingCountry);

      await expect(service.updatePatch(1, updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove country successfully', async () => {
      const countryToRemove: Country = { id: 1, name: 'Argentina', code: 'AR', provinces: [] };
    
      // El servicio llama a findOne una vez para encontrar la entidad y sus relaciones.
      mockCountryRepository.findOne.mockResolvedValue(countryToRemove);
      // Mockeamos `remove` para que no haga nada y devuelva una promesa resuelta.
      mockCountryRepository.remove.mockResolvedValue(undefined);

      const result = await service.remove(1);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 }, relations: ['provinces'] });
      expect(mockCountryRepository.remove).toHaveBeenCalledWith(countryToRemove);
      expect(result).toEqual({ message: 'País con ID 1 eliminado correctamente.' });
    });

    it('should throw NotFoundException when country not found', async () => {
      // findOne no encuentra el país a eliminar.
      mockCountryRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when country has provinces', async () => {
      const countryWithProvinces: Country = {
        id: 1,
        name: 'Argentina',
        code: 'AR',
        provinces: [{ id: 1, name: 'Buenos Aires', country: null } as any],
      };

      // findOne encuentra el país, y este tiene provincias.
      mockCountryRepository.findOne.mockResolvedValue(countryWithProvinces);

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
      // Verificamos que `remove` no haya sido llamado, ya que la excepción se lanza antes.
      expect(mockCountryRepository.remove).not.toHaveBeenCalled();
    });
  });
});
