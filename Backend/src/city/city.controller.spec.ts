import { Test, TestingModule } from '@nestjs/testing';
import { CitiesController } from './city.controller';
import { CitiesService } from './city.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateCityDto } from '../dto/create-city.dto';
import { UpdateCityDto } from '../dto/update-patch-city.dto';
import { UpdatePutCityDto } from '../dto/update-put-city.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { BadRequestException } from '@nestjs/common';

describe('CitiesController', () => {
  let controller: CitiesController;
  let citiesService: jest.Mocked<CitiesService>;

  const mockCitiesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByProvince: jest.fn(),
    searchByName: jest.fn(),
    updatePut: jest.fn(),
    updatePatch: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CitiesController],
      providers: [
        { provide: CitiesService, useValue: mockCitiesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CitiesController>(CitiesController);
    citiesService = module.get(CitiesService);

    jest.clearAllMocks();
  });

  it('debe ser definido', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateCityDto = {
      name: 'Buenos Aires',
      latitude: -34.6037,
      longitude: -58.3816,
      provinceId: 1,
    };

    it('debería crear una nueva ciudad', async () => {
      const result = { id: 1, name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816, province: { id: 1, name: 'Buenos Aires' } };
      mockCitiesService.create.mockResolvedValue(result);

      const response = await controller.create(createDto);

      expect(citiesService.create).toHaveBeenCalledWith(createDto, false);
      expect(response).toEqual(result);
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10 };

    it('debería devolver todas las ciudades con paginación', async () => {
      const result = { data: [{ id: 1, name: 'City1' }], meta: { totalItems: 1, totalPages: 1, currentPage: 1 } };
      mockCitiesService.findAll.mockResolvedValue(result);

      const response = await controller.findAll(paginationDto);

      expect(citiesService.findAll).toHaveBeenCalledWith(paginationDto);
      expect(response).toEqual(result);
    });
  });

  describe('findCitiesByProvince', () => {
    it('debería devolver las ciudades por identificación de provincia', async () => {
      const result = { data: [{ id: 1, name: 'City1' }], meta: { totalItems: 1, totalPages: 1, currentPage: 1 } };
      mockCitiesService.findByProvince.mockResolvedValue(result);

      const response = await controller.findCitiesByProvince(1);

      expect(citiesService.findByProvince).toHaveBeenCalledWith(1);
      expect(response).toEqual(result);
    });
  });

  describe('searchByName', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10, name: 'Buenos' };

    it('debería buscar ciudades por nombre', async () => {
      const result = { data: [{ id: 1, name: 'Buenos Aires' }], meta: { totalItems: 1, totalPages: 1, currentPage: 1 } };
      mockCitiesService.searchByName.mockResolvedValue(result);

      const response = await controller.searchByName(paginationDto);

      expect(citiesService.searchByName).toHaveBeenCalledWith('Buenos', paginationDto);
      expect(response).toEqual(result);
    });

    it('debería lanzar BadRequestException para un término de búsqueda vacío', async () => {
      const emptyPagination: PaginationDto = { page: 1, limit: 10, name: '' };

      await expect(controller.searchByName(emptyPagination)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('debería devolver una ciudad por id', async () => {
      const result = { id: 1, name: 'City1', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1' } };
      mockCitiesService.findOne.mockResolvedValue(result);

      const response = await controller.findOne(1);

      expect(citiesService.findOne).toHaveBeenCalledWith(1, false);
      expect(response).toEqual(result);
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
      const result = { id: 1, name: 'Updated City', latitude: -34.6037, longitude: -58.3816, province: { id: 1, name: 'Province1' } };
      mockCitiesService.updatePut.mockResolvedValue(result);

      const response = await controller.updatePut(1, updateDto);

      expect(citiesService.updatePut).toHaveBeenCalledWith(1, updateDto);
      expect(response).toEqual(result);
    });
  });

  describe('updatePatch', () => {
    const updateDto: UpdateCityDto = {
      name: 'Patched City',
    };

    it('debería actualizar una ciudad parcialmente', async () => {
      const result = { id: 1, name: 'Patched City', latitude: 0, longitude: 0, province: { id: 1, name: 'Province1' } };
      mockCitiesService.updatePatch.mockResolvedValue(result);

      const response = await controller.updatePatch(1, updateDto);

      expect(citiesService.updatePatch).toHaveBeenCalledWith(1, updateDto);
      expect(response).toEqual(result);
    });
  });

  describe('remove', () => {
    it('deberia eliminar una ciudad', async () => {
      const result = { message: 'Ciudad con ID 1 eliminada correctamente.' };
      mockCitiesService.remove.mockResolvedValue(result);

      const response = await controller.remove(1);

      expect(citiesService.remove).toHaveBeenCalledWith(1);
      expect(response).toEqual(result);
    });
  });
});
