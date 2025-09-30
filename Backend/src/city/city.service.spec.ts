//src\city\city.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CitiesService } from './city.service';
import { City } from '../entities/city.entity';
import { Province } from '../entities/province.entity';
import { CreateCityDto } from '../dto/create-city.dto';
import { UpdatePutCityDto } from '../dto/update-put-city.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';
import { PaginationDto } from '../dto/pagination.dto';

describe('CitiesService', () => {
  let service: CitiesService;
  let cityRepository: jest.Mocked<Repository<City>>;
  let provinceRepository: jest.Mocked<Repository<Province>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CitiesService,
        {
          provide: getRepositoryToken(City),
          useValue: { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), remove: jest.fn(), findAndCount: jest.fn(), find: jest.fn() },
        },
        { provide: getRepositoryToken(Province), useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get<CitiesService>(CitiesService);
    cityRepository = module.get(getRepositoryToken(City));
    provinceRepository = module.get(getRepositoryToken(Province));
  });

  afterEach(() => jest.clearAllMocks());

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('findProvinceById (método privado)', () => {
    it('debería lanzar NotFoundException si la provincia no se encuentra', async () => {
      provinceRepository.findOne.mockResolvedValue(null);
      await expect((service as any).findProvinceById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createCityDto: CreateCityDto = { name: 'Córdoba', provinceId: 1, latitude: -31.42, longitude: -64.18 };
    const mockProvince = { id: 1, name: 'Córdoba', country: { id: 1, name: 'Argentina' } } as Province;
    const mockCity = { id: 101, ...createCityDto, province: mockProvince };

    it('debería crear una nueva ciudad exitosamente', async () => {
        provinceRepository.findOne.mockResolvedValue(mockProvince);
        cityRepository.findOne.mockResolvedValue(null);
        cityRepository.create.mockReturnValue(mockCity as any);
        cityRepository.save.mockResolvedValue(mockCity as any);
        cityRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(mockCity as any);
  
        await service.create(createCityDto, false);
        expect(cityRepository.save).toHaveBeenCalledWith(mockCity);
    });

    it('debería devolver una ciudad existente si las coordenadas coinciden', async () => {
      provinceRepository.findOne.mockResolvedValue(mockProvince);
      cityRepository.findOne.mockResolvedValue(mockCity as any);
      await service.create(createCityDto, false);
      expect(cityRepository.save).not.toHaveBeenCalled();
    });

    it('debería registrar un warning si el nombre de la ciudad ya existe', async () => {
        provinceRepository.findOne.mockResolvedValue(mockProvince);
        cityRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(mockCity as any).mockResolvedValueOnce({ ...mockCity, province: mockProvince } as any);
        cityRepository.create.mockReturnValue({ ...mockCity, province: mockProvince } as any);
        cityRepository.save.mockResolvedValue({ ...mockCity, province: mockProvince } as any);
        const loggerSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
        await service.create(createCityDto, false);
        expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Conflicto nominal'));
        loggerSpy.mockRestore();
    });
    
    it('debería manejar una colisión de BD donde la ciudad finalmente no se encuentra', async () => {
        const dbError = { code: '23505' };
        provinceRepository.findOne.mockResolvedValue(mockProvince);
        cityRepository.findOne.mockResolvedValue(null);
        cityRepository.create.mockReturnValue(mockCity as any);
        cityRepository.save.mockRejectedValue(dbError);
        cityRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        await expect(service.create({} as any, false)).rejects.toThrow(ConflictException);
    });

    it('debería manejar una colisión de BD y retornar la ciudad existente', async () => {
        const dbError = { code: '23505' };
        provinceRepository.findOne.mockResolvedValue(mockProvince);
        cityRepository.findOne.mockResolvedValue(null);
        cityRepository.create.mockReturnValue(mockCity as any);
        cityRepository.save.mockRejectedValue(dbError);
        cityRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(mockCity as any);
        const result = await service.create(createCityDto, false);
        expect(result).toBeDefined();
    });

    it('debería manejar un error genérico (no de BD) durante el guardado', async () => {
        const genericError = new Error('Error genérico');
        provinceRepository.findOne.mockResolvedValue(mockProvince);
        cityRepository.findOne.mockResolvedValue(null);
        cityRepository.create.mockReturnValue(mockCity as any);
        cityRepository.save.mockRejectedValue(genericError);
        await expect(service.create({} as any, false)).rejects.toThrow(genericError);
    });
  });

  describe('Find Methods', () => {
    const mockFullCity = { id: 1, name: 'Rosario', province: { id: 2, name: 'Santa Fe', country: { id: 1, name: 'Argentina' } } } as City;

    it('findAll: debería usar ordenamiento por defecto si no se especifica', async () => {
        cityRepository.findAndCount.mockResolvedValue([[], 0]);
        await service.findAll({});
        expect(cityRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ order: { id: 'ASC' } }));
    });
    
    it('findByProvince: debería devolver ciudades por provincia', async () => {
      const mockCities = [{ id: 1, name: 'Villa María' }];
      cityRepository.findAndCount.mockResolvedValue([mockCities as any[], 1]);
      const result = await service.findByProvince(1);
      expect(result).toBeInstanceOf(PaginatedResponseDto);
    });

    it('mapToResponseDto: debería lanzar un error si faltan relaciones', () => {
      const cityWithoutRelations = { id: 1, name: 'Ciudad Rota' } as City;
      expect(() => (service as any).mapToResponseDto(cityWithoutRelations)).toThrow('Las relaciones de provincia/país no están cargadas para la ciudad.');
    });

    it('findAll: debería lanzar BadRequestException si el campo de ordenamiento no es válido', async () => {
      const paginationDto: PaginationDto = { sortBy: 'campoInvalido' };
      await expect(service.findAll(paginationDto)).rejects.toThrow(BadRequestException);
    });

    it('findOne: debería devolver una ciudad si la encuentra', async () => {
      cityRepository.findOne.mockResolvedValue(mockFullCity);
      const result = await service.findOne(1, false, true);
      expect(result).toEqual(mockFullCity);
    });

    it('findOne: debería lanzar NotFoundException si la ciudad no existe', async () => {
      cityRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('findOneByNameAndProvinceName: debería encontrar una ciudad', async () => {
        cityRepository.findOne.mockResolvedValue(mockFullCity as any);
        await service.findOneByNameAndProvinceName('Rosario', 'Santa Fe');
        expect(cityRepository.findOne).toHaveBeenCalled();
    });

    it('findOneByNameAndProvinceName: debería registrar warning si múltiples ciudades encontradas sin provincia', async () => {
        const multipleCities = [mockFullCity, { ...mockFullCity, id: 2 }];
        cityRepository.find.mockResolvedValue(multipleCities as any);
        const loggerSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
        await service.findOneByNameAndProvinceName('Rosario', '');
        expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Múltiples ciudades encontradas'));
        loggerSpy.mockRestore();
    });
  
    it('findOneByNameAndProvinceId: debería encontrar una ciudad', async () => {
        cityRepository.findOne.mockResolvedValue(mockFullCity as any);
        await service.findOneByNameAndProvinceId('Rosario', 2);
        expect(cityRepository.findOne).toHaveBeenCalled();
    });

    it('searchByName: debería devolver ciudades que coincidan', async () => {
        cityRepository.findAndCount.mockResolvedValue([[mockFullCity] as any[], 1]);
        const result = await service.searchByName('Rosario', {});
        expect(result.data.length).toBe(1);
    });
  });

  describe('Update Methods', () => {
    const mockCity = { id: 1, name: 'Rosario', provinceId: 2, latitude: -32.94, longitude: -60.63, province: { id: 2, name: 'Santa Fe', country: { id: 1, name: 'Argentina' } } } as City;
    const newProvince = { id: 3, name: 'Buenos Aires', country: {id: 1, name: 'Argentina'} } as Province;

    describe('updatePut', () => {
        const updateDto: UpdatePutCityDto = { name: 'Mar del Plata', provinceId: 3, latitude: -38.00, longitude: -57.55 };

        it('debería actualizar una ciudad completamente', async () => {
            const updatedCity = { ...mockCity, ...updateDto, province: newProvince };
            cityRepository.findOne.mockResolvedValueOnce(mockCity).mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(updatedCity as any);
            provinceRepository.findOne.mockResolvedValue(newProvince as any);
            cityRepository.save.mockResolvedValue(updatedCity as any);
            await service.updatePut(1, updateDto);
            expect(cityRepository.save).toHaveBeenCalled();
        });

        it('debería lanzar NotFoundException si no se puede recargar la ciudad actualizada', async () => {
            const updatedCity = { ...mockCity, ...updateDto, province: newProvince };
            cityRepository.findOne.mockResolvedValueOnce(mockCity).mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
            provinceRepository.findOne.mockResolvedValue(newProvince as any);
            cityRepository.save.mockResolvedValue(updatedCity as any);
            await expect(service.updatePut(1, updateDto)).rejects.toThrow(NotFoundException);
        });
    });
  
    describe('updatePatch', () => {
      it('debería actualizar el nombre de una ciudad exitosamente', async () => {
        const updateDto = { name: 'Rosario Actualizado' };
        const updatedCity = { ...mockCity, ...updateDto };
        cityRepository.findOne.mockResolvedValueOnce(mockCity).mockResolvedValueOnce(null).mockResolvedValueOnce(updatedCity as any);
        cityRepository.save.mockResolvedValue(updatedCity as any);
        await service.updatePatch(1, updateDto);
        expect(cityRepository.save).toHaveBeenCalledWith(expect.objectContaining(updateDto));
      });

      it('debería lanzar ConflictException si el nuevo nombre y provincia ya existen', async () => {
        const updateDto = { name: 'Ciudad Existente', provinceId: 3 };
        const conflictingCity = { id: 2, name: 'Ciudad Existente' };
        provinceRepository.findOne.mockResolvedValue(newProvince);
        cityRepository.findOne.mockResolvedValueOnce(mockCity).mockResolvedValueOnce(conflictingCity as any);
        await expect(service.updatePatch(1, updateDto)).rejects.toThrow(ConflictException);
      });

      it('debería lanzar NotFoundException si no se puede recargar la ciudad actualizada en PATCH', async () => {
        const updateDto = { name: 'Rosario Actualizado' };
        const updatedCity = { ...mockCity, ...updateDto };
        cityRepository.findOne.mockResolvedValueOnce(mockCity).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        cityRepository.save.mockResolvedValue(updatedCity as any);
        await expect(service.updatePatch(1, updateDto)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('remove', () => {
    it('debería lanzar NotFoundException si la ciudad a eliminar no existe', async () => {
      cityRepository.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('debería eliminar una ciudad si no tiene personas asociadas', async () => {
      const mockCity = { id: 1, name: 'Rosario', persons: [] };
      cityRepository.findOne.mockResolvedValue(mockCity as any);
      await service.remove(1);
      expect(cityRepository.remove).toHaveBeenCalledWith(mockCity);
    });

    it('debería lanzar ConflictException si la ciudad tiene personas asociadas', async () => {
      const mockCityWithPerson = { id: 1, name: 'Rosario', persons: [{ id: 1 }] };
      cityRepository.findOne.mockResolvedValue(mockCityWithPerson as any);
      await expect(service.remove(1)).rejects.toThrow(ConflictException);
    });
  });
});