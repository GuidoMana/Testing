import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CitiesService } from './city.service';
import { City } from '../entities/city.entity';
import { Province } from '../entities/province.entity';
import { Country } from '../entities/country.entity';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateCityDto } from '../dto/create-city.dto';
import { UpdateCityDto } from '../dto/update-patch-city.dto';
import { UpdatePutCityDto } from '../dto/update-put-city.dto';
import { PaginationDto } from '../dto/pagination.dto';

describe('CitiesService', () => {
  let service: CitiesService;
  let cityRepository: Repository<City>;
  let provinceRepository: Repository<Province>;

  const mockCityRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    preload: jest.fn(),
    remove: jest.fn(),
  };

  const mockProvinceRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CitiesService,
        {
          provide: getRepositoryToken(City),
          useValue: mockCityRepository,
        },
        {
          provide: getRepositoryToken(Province),
          useValue: mockProvinceRepository,
        },
      ],
    }).compile();

    service = module.get<CitiesService>(CitiesService);
    cityRepository = module.get<Repository<City>>(getRepositoryToken(City));
    provinceRepository = module.get<Repository<Province>>(getRepositoryToken(Province));

    jest.clearAllMocks();
  });

  it('debe ser definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateCityDto = {
      name: 'Buenos Aires',
      latitude: -34.6037,
      longitude: -58.3816,
      provinceId: 1,
    };

    it('debería crear una nueva ciudad con éxito', async () => {
      const province = { id: 1, name: 'Buenos Aires', country: { id: 1, name: 'Argentina' } };
      const city = { id: 1, ...createDto, province, provinceId: 1 };
      const savedCity = { ...city };

      mockProvinceRepository.findOne.mockResolvedValue(province);
      mockCityRepository.findOne.mockResolvedValue(null);
      mockCityRepository.create.mockReturnValue(city);
      mockCityRepository.save.mockResolvedValue(savedCity);
      mockCityRepository.findOne.mockResolvedValue(savedCity);

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Buenos Aires');
    });

    it('debería devolver la ciudad existente si las coordenadas coinciden', async () => {
      const province = { id: 1, name: 'Buenos Aires', country: { id: 1, name: 'Argentina' } };
      const existingCity = { id: 2, name: 'Existing City', latitude: -34.6037, longitude: -58.3816, province, provinceId: 1 };

      mockProvinceRepository.findOne.mockResolvedValue(province);
      mockCityRepository.findOne.mockResolvedValue(existingCity);

      const result = await service.create(createDto);

      expect(result.id).toBe(2);
      expect(result.name).toBe('Existing City');
    });

    it('debería lanzar NotFoundException si no se encuentra la provincia', async () => {
      mockProvinceRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('debe manejar la violación de restricciones de la base de datos', async () => {
      const province = { id: 1, name: 'Buenos Aires', country: { id: 1, name: 'Argentina' } };
      const error = new Error('Database error');
      (error as any).code = '23505';

      mockProvinceRepository.findOne.mockResolvedValue(province);
      mockCityRepository.findOne.mockResolvedValue(null);
      mockCityRepository.create.mockReturnValue({ ...createDto, province, provinceId: 1 });
      mockCityRepository.save.mockRejectedValue(error);
      mockCityRepository.findOne.mockResolvedValue({ id: 1, ...createDto, province, provinceId: 1 });

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10 };

    it('deberían devolverse las ciudades paginadas', async () => {
      const cities = [{ id: 1, name: 'City1', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } } }];
      mockCityRepository.findAndCount.mockResolvedValue([cities, 1]);

      const result = await service.findAll(paginationDto);

      expect(result.data.length).toBe(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it('debería lanzar BadRequestException para un campo de clasificación no válido', async () => {
      const invalidPagination: PaginationDto = { page: 1, limit: 10, sortBy: 'invalidField' };

      await expect(service.findAll(invalidPagination)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('debería devolver una ciudad por id', async () => {
      const city = { id: 1, name: 'City1', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } } };
      mockCityRepository.findOne.mockResolvedValue(city);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('City1');
    });

    it('debería lanzar NotFoundException si no se encuentra la ciudad', async () => {
      mockCityRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProvince', () => {
    it('debería devolver las ciudades por identificación de provincia', async () => {
      const cities = [{ id: 1, name: 'City1', latitude: 0, longitude: 0 }];
      mockCityRepository.findAndCount.mockResolvedValue([cities, 1]);

      const result = await service.findByProvince(1);

      expect(result.data.length).toBe(1);
    });
  });

  describe('findOneByNameAndProvinceName', () => {
    it('debería devolver la ciudad cuando se encuentre con la provincia', async () => {
      const city = { id: 1, name: 'City1', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } }, provinceId: 1 };
      mockCityRepository.findOne.mockResolvedValue(city);

      const result = await service.findOneByNameAndProvinceName('City1', 'Province1');

      expect(result).toEqual({ id: 1, name: 'City1', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1' } });
    });

    it('debería devolver nulo cuando no se encuentre la ciudad', async () => {
      mockCityRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneByNameAndProvinceName('NonExistent', 'Province1');

      expect(result).toBeNull();
    });

    it('debería devolver la primera ciudad cuando se encuentren varias sin provincia', async () => {
      const cities = [
        { id: 1, name: 'City1', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } }, provinceId: 1 },
        { id: 2, name: 'City1', latitude: 1, longitude: 1, province: { id: 2, name: 'Province2', country: { id: 1, name: 'Country1' } }, provinceId: 2 }
      ];
      mockCityRepository.find.mockResolvedValue(cities);

      const result = await service.findOneByNameAndProvinceName('City1', '');

      expect(result).toEqual({ id: 1, name: 'City1', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1' } });
    });
  });

  describe('findOneByNameAndProvinceId', () => {
    it('debería regresar a la ciudad cuando la encuentre', async () => {
      const city = { id: 1, name: 'City1', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } }, provinceId: 1 };
      mockCityRepository.findOne.mockResolvedValue(city);

      const result = await service.findOneByNameAndProvinceId('City1', 1);

      expect(result).toEqual({ id: 1, name: 'City1', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1' } });
    });

    it('debería devolver nulo cuando no se encuentre la ciudad', async () => {
      mockCityRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneByNameAndProvinceId('NonExistent', 1);

      expect(result).toBeNull();
    });
  });

  describe('searchByName', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10 };

    it('debería buscar ciudades por nombre', async () => {
      const cities = [{ id: 1, name: 'Buenos Aires', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } } }];
      mockCityRepository.findAndCount.mockResolvedValue([cities, 1]);

      const result = await service.searchByName('Buenos', paginationDto);

      expect(result.data.length).toBe(1);
    });

    it('debería lanzar BadRequestException para un término de búsqueda vacío', async () => {
      await expect(service.searchByName('', paginationDto)).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar BadRequestException para un campo de clasificación no válido', async () => {
      const invalidPagination: PaginationDto = { page: 1, limit: 10, sortBy: 'invalidField' };

      await expect(service.searchByName('test', invalidPagination)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePut', () => {
    const updateDto: UpdatePutCityDto = {
      name: 'Updated City',
      latitude: -34.6037,
      longitude: -58.3816,
      provinceId: 1,
    };

    it('debería actualizar una ciudad por completo', async () => {
      const city = { id: 1, name: 'Old City', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } }, provinceId: 1 };
      const province = { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } };
      const updatedCity = { ...city, ...updateDto, province };

      mockCityRepository.findOne.mockResolvedValueOnce(city);
      mockProvinceRepository.findOne.mockResolvedValue(province);
      mockCityRepository.findOne.mockResolvedValueOnce(null); // No existing city with same coords
      mockCityRepository.findOne.mockResolvedValueOnce(null); // No existing city with same name/province
      mockCityRepository.save.mockResolvedValue(updatedCity);
      mockCityRepository.findOne.mockResolvedValueOnce(updatedCity);

      const result = await service.updatePut(1, updateDto);

      expect(result.name).toBe('Updated City');
    });

    it('debería lanzar NotFoundException si no se encuentra la ciudad', async () => {
      mockCityRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePut(999, updateDto)).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar una ConflictException para coordenadas duplicadas', async () => {
      const city = { id: 1, name: 'City1', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } }, provinceId: 1 };
      mockProvinceRepository.findOne.mockResolvedValue({ id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } });
      mockCityRepository.findOne.mockResolvedValueOnce(city);
      mockCityRepository.findOne.mockResolvedValueOnce({ id: 2, name: 'Existing City' });

      await expect(service.updatePut(1, updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('updatePatch', () => {
    const updateDto: UpdateCityDto = {
      name: 'Patched City',
    };

    it('debería actualizar una ciudad parcialmente', async () => {
      const city = { id: 1, name: 'Old City', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } }, provinceId: 1 };
      const updatedCity = { ...city, name: 'Patched City' };

      let callCount = 0;
      mockCityRepository.findOne.mockImplementation((options) => {
        callCount++;
        if (callCount === 1) {
          // First call: find existing city
          return Promise.resolve(city);
        } else if (callCount === 2) {
          // Second call: check name/province conflict
          return Promise.resolve(null);
        } else if (callCount === 3 && options?.relations?.includes('province')) {
          // Third call: reload updated city with relations
          return Promise.resolve(updatedCity);
        }
        return Promise.resolve(null);
      });

      mockCityRepository.save.mockResolvedValue(updatedCity);

      const result = await service.updatePatch(1, updateDto);

      expect(result.name).toBe('Patched City');
    });

    it('debería lanzar NotFoundException si no se encuentra la ciudad', async () => {
      mockCityRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePatch(999, updateDto)).rejects.toThrow(NotFoundException);
    });

    it('debería actualizar la ciudad con el cambio de provincia', async () => {
      const updateDtoWithProvince = { provinceId: 2 };
      const city = { id: 1, name: 'Old City', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } }, provinceId: 1 };
      const newProvince = { id: 2, name: 'Province2', country: { id: 1, name: 'Country1' } };
      const updatedCity = { ...city, province: newProvince, provinceId: 2 };

      let callCount = 0;
      mockCityRepository.findOne.mockImplementation((options) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(city);
        } else if (callCount === 2) {
          return Promise.resolve(null);
        } else if (callCount === 3 && options?.relations?.includes('province')) {
          return Promise.resolve(updatedCity);
        }
        return Promise.resolve(null);
      });

      mockProvinceRepository.findOne.mockResolvedValue(newProvince);
      mockCityRepository.save.mockResolvedValue(updatedCity);

      const result = await service.updatePatch(1, updateDtoWithProvince);

      expect(result.province.id).toBe(2);
    });

    it('debería actualizar la ciudad con el cambio de coordenadas', async () => {
      const updateDtoWithCoords = { latitude: 1, longitude: 1 };
      const city = { id: 1, name: 'Old City', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1', country: { id: 1, name: 'Country1' } }, provinceId: 1 };
      const updatedCity = { ...city, latitude: 1, longitude: 1 };

      let callCount = 0;
      mockCityRepository.findOne.mockImplementation((options) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(city);
        } else if (callCount === 2) {
          return Promise.resolve(null); // No coords conflict
        } else if (callCount === 3 && options?.relations?.includes('province')) {
          return Promise.resolve(updatedCity);
        }
        return Promise.resolve(null);
      });

      mockCityRepository.save.mockResolvedValue(updatedCity);

      const result = await service.updatePatch(1, updateDtoWithCoords);

      expect(result.latitude).toBe(1);
      expect(result.longitude).toBe(1);
    });
  });

  describe('remove', () => {
    it('debería eliminar una ciudad con éxito', async () => {
      const city = { id: 1, name: 'City1', persons: [] };
      mockCityRepository.findOne.mockResolvedValue(city);

      const result = await service.remove(1);

      expect(result.message).toContain('eliminada correctamente');
    });

    it('debería lanzar NotFoundException si no se encuentra la ciudad', async () => {
      mockCityRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar ConflictException si la ciudad tiene personas asociadas', async () => {
      const city = { id: 1, name: 'City1', persons: [{ id: 1 }] };
      mockCityRepository.findOne.mockResolvedValue(city);

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
    });
  });
});
