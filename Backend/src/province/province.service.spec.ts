import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { ProvincesService } from './province.service';
import { Province } from '../entities/province.entity';
import { Country } from '../entities/country.entity';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateProvinceDto } from '../dto/create-province.dto';
import { UpdatePutProvinceDto } from '../dto/update-put-province.dto';
import { UpdateProvinceDto } from '../dto/update-patch-province.dto';
import { PaginationDto } from '../dto/pagination.dto';

describe('ProvincesService', () => {
  let service: ProvincesService;
  let provinceRepository: Repository<Province>;
  let countryRepository: Repository<Country>;

  const mockProvinceRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    preload: jest.fn(),
    remove: jest.fn(),
  };

  const mockCountryRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvincesService,
        {
          provide: getRepositoryToken(Province),
          useValue: mockProvinceRepository,
        },
        {
          provide: getRepositoryToken(Country),
          useValue: mockCountryRepository,
        },
      ],
    }).compile();

    service = module.get<ProvincesService>(ProvincesService);
    provinceRepository = module.get<Repository<Province>>(getRepositoryToken(Province));
    countryRepository = module.get<Repository<Country>>(getRepositoryToken(Country));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateProvinceDto = {
      name: 'Buenos Aires',
      countryId: 1,
      latitude: -34.6037,
      longitude: -58.3816,
    };

    it('should create a new province successfully', async () => {
      mockCountryRepository.findOne.mockResolvedValue({ id: 1, name: 'Argentina' });
      mockProvinceRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1, ...createDto, country: { id: 1, name: 'Argentina' } });
      mockProvinceRepository.create.mockReturnValue(createDto);
      mockProvinceRepository.save.mockResolvedValue({ id: 1, ...createDto, country: { id: 1, name: 'Argentina' } });

      const result = await service.create(createDto);

      expect(mockCountryRepository.findOne).toHaveBeenCalledWith({ where: { id: createDto.countryId } });
      expect(mockProvinceRepository.findOne).toHaveBeenCalledWith({ where: { latitude: createDto.latitude, longitude: createDto.longitude } });
      expect(mockProvinceRepository.create).toHaveBeenCalled();
      expect(mockProvinceRepository.save).toHaveBeenCalled();
      expect(result.name).toEqual(createDto.name);
    });

    it('should return existing province if coordinates match', async () => {
      const existing = { id: 2, name: 'Existing Province', latitude: -34.6037, longitude: -58.3816, country: { id: 1, name: 'Argentina' } };
      mockCountryRepository.findOne.mockResolvedValue({ id: 1, name: 'Argentina' });
      mockProvinceRepository.findOne.mockResolvedValue(existing);

      const result = await service.create(createDto);

      expect(result.id).toBe(2);
    });

    it('should throw NotFoundException if country not found', async () => {
      mockCountryRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on database error', async () => {
      mockCountryRepository.findOne.mockResolvedValue({ id: 1, name: 'Argentina' });
      mockProvinceRepository.findOne.mockResolvedValue(null);
      mockProvinceRepository.create.mockReturnValue(createDto);
      mockProvinceRepository.save.mockRejectedValue({ code: '23505' });
      mockProvinceRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated provinces', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const provinces = [{ id: 1, name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816, country: { id: 1, name: 'Argentina' } }];
      mockProvinceRepository.findAndCount.mockResolvedValue([provinces, 1]);

      const result = await service.findAll(paginationDto);

      expect(result.data.length).toBe(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it('should throw BadRequestException for invalid sortBy', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10, sortBy: 'invalid' };

      await expect(service.findAll(paginationDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a province by id', async () => {
      const province = { id: 1, name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816, country: { id: 1, name: 'Argentina' } };
      mockProvinceRepository.findOne.mockResolvedValue(province);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if province not found', async () => {
      mockProvinceRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneByNameAndCountryId', () => {
    it('should return a province by name and countryId', async () => {
      const province = { id: 1, name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816, country: { id: 1, name: 'Argentina' } };
      mockProvinceRepository.findOne.mockResolvedValue(province);

      const result = await service.findOneByNameAndCountryId('Buenos Aires', 1);

      expect(result?.id).toBe(1);
    });

    it('should return null if not found', async () => {
      mockProvinceRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneByNameAndCountryId('Nonexistent', 1);

      expect(result).toBeNull();
    });
  });

  describe('searchByName', () => {
    it('should search provinces by name', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10, name: 'Buenos' };
      const provinces = [{ id: 1, name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816, country: { id: 1, name: 'Argentina' } }];
      mockProvinceRepository.findAndCount.mockResolvedValue([provinces, 1]);

      const result = await service.searchByName('Buenos', paginationDto);

      expect(result.data.length).toBe(1);
    });

    it('should throw BadRequestException for empty term', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };

      await expect(service.searchByName('', paginationDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePut', () => {
    const updateDto: UpdatePutProvinceDto = {
      name: 'Updated Province',
      countryId: 1,
      latitude: -35.0,
      longitude: -59.0,
    };

    it('should update a province fully', async () => {
      const province = { id: 1, name: 'Old Name', latitude: -34.6037, longitude: -58.3816, countryId: 1, country: { id: 1, name: 'Argentina' } };
      mockProvinceRepository.findOne.mockResolvedValue(province);
      mockCountryRepository.findOne.mockResolvedValue({ id: 1, name: 'Argentina' });
      mockProvinceRepository.findOne.mockResolvedValueOnce(province).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockProvinceRepository.save.mockResolvedValue({ ...province, ...updateDto });
      mockProvinceRepository.findOne.mockResolvedValue({ ...province, ...updateDto });

      const result = await service.updatePut(1, updateDto);

      expect(result.name).toBe('Updated Province');
    });

    it('should throw NotFoundException if province not found', async () => {
      mockProvinceRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePut(999, updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate coordinates', async () => {
      const province = { id: 1, name: 'Old Name', latitude: -34.6037, longitude: -58.3816, countryId: 1, country: { id: 1, name: 'Argentina' } };
      mockProvinceRepository.findOne.mockResolvedValue(province);
      mockCountryRepository.findOne.mockResolvedValue({ id: 1, name: 'Argentina' });
      mockProvinceRepository.findOne.mockResolvedValue({ id: 2 });

      await expect(service.updatePut(1, updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('updatePatch', () => {
    const updateDto: UpdateProvinceDto = { name: 'Patched Name' };

    it('should update a province partially', async () => {
      const province = { id: 1, name: 'Old Name', latitude: -34.6037, longitude: -58.3816, countryId: 1, country: { id: 1, name: 'Argentina' } };
      const updated = { ...province, name: 'Patched Name' };
      mockProvinceRepository.findOne.mockResolvedValueOnce(province).mockResolvedValueOnce(null).mockResolvedValueOnce(updated);
      mockProvinceRepository.save.mockResolvedValue(updated);

      const result = await service.updatePatch(1, updateDto);

      expect(result.name).toBe('Patched Name');
    });

    it('should throw NotFoundException if province not found', async () => {
      mockProvinceRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePatch(999, updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a province successfully', async () => {
      const province = { id: 1, name: 'Province', cities: [] };
      mockProvinceRepository.findOne.mockResolvedValue(province);

      const result = await service.remove(1);

      expect(result.message).toContain('eliminada correctamente');
    });

    it('should throw NotFoundException if province not found', async () => {
      mockProvinceRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if province has cities', async () => {
      const province = { id: 1, name: 'Province', cities: [{ id: 1 }] };
      mockProvinceRepository.findOne.mockResolvedValue(province);

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
    });
  });

  describe('findByCountry', () => {
    it('should return provinces by country', async () => {
      const provinces = [{ id: 1, name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816, country: { id: 1, name: 'Argentina' } }];
      mockProvinceRepository.findAndCount.mockResolvedValue([provinces, 1]);

      const result = await service.findByCountry(1);

      expect(result.data.length).toBe(1);
    });
  });
});
