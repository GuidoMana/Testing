import { Test, TestingModule } from '@nestjs/testing';
import { CountriesController } from './country.controller';
import { CountriesService } from './country.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateCountryDto } from '../dto/create-country.dto';
import { UpdateCountryDto } from '../dto/update-patch-country.dto';
import { UpdatePutCountryDto } from '../dto/update-put-country.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { BadRequestException } from '@nestjs/common';

describe('CountriesController', () => {
  let controller: CountriesController;
  let countriesService: jest.Mocked<CountriesService>;

  const mockCountriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOneByName: jest.fn(),
    searchByName: jest.fn(),
    updatePut: jest.fn(),
    updatePatch: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CountriesController],
      providers: [
        { provide: CountriesService, useValue: mockCountriesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CountriesController>(CountriesController);
    countriesService = module.get(CountriesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateCountryDto = {
      name: 'Argentina',
      code: 'AR',
    };

    it('should create a new country', async () => {
      const result = { id: 1, name: 'Argentina', code: 'AR' };
      mockCountriesService.create.mockResolvedValue(result);

      const response = await controller.create(createDto);

      expect(countriesService.create).toHaveBeenCalledWith(createDto, false);
      expect(response).toEqual(result);
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10 };

    it('should return all countries with pagination', async () => {
      const result = { data: [{ id: 1, name: 'Argentina', code: 'AR' }], meta: { totalItems: 1, totalPages: 1, currentPage: 1 } };
      mockCountriesService.findAll.mockResolvedValue(result);

      const response = await controller.findAll(paginationDto);

      expect(countriesService.findAll).toHaveBeenCalledWith(false, paginationDto);
      expect(response).toEqual(result);
    });
  });

  describe('searchByName', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10, name: 'Arg' };

    it('should search countries by name', async () => {
      const result = { data: [{ id: 1, name: 'Argentina', code: 'AR' }], meta: { totalItems: 1, totalPages: 1, currentPage: 1 } };
      mockCountriesService.searchByName.mockResolvedValue(result);

      const response = await controller.searchByName(paginationDto);

      expect(countriesService.searchByName).toHaveBeenCalledWith('Arg', false, paginationDto);
      expect(response).toEqual(result);
    });

    it('should throw BadRequestException for empty search term', async () => {
      const emptyPagination: PaginationDto = { page: 1, limit: 10, name: '' };

      await expect(controller.searchByName(emptyPagination)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a country by id', async () => {
      const result = { id: 1, name: 'Argentina', code: 'AR' };
      mockCountriesService.findOne.mockResolvedValue(result);

      const response = await controller.findOne(1);

      expect(countriesService.findOne).toHaveBeenCalledWith(1, false);
      expect(response).toEqual(result);
    });
  });

  describe('updatePut', () => {
    const updateDto: UpdatePutCountryDto = {
      name: 'Argentina Updated',
      code: 'ARG',
    };

    it('should update a country fully', async () => {
      const result = { id: 1, name: 'Argentina Updated', code: 'ARG' };
      mockCountriesService.updatePut.mockResolvedValue(result);

      const response = await controller.updatePut(1, updateDto);

      expect(countriesService.updatePut).toHaveBeenCalledWith(1, updateDto);
      expect(response).toEqual(result);
    });
  });

  describe('updatePatch', () => {
    const updateDto: UpdateCountryDto = {
      name: 'Argentina Patched',
    };

    it('should update a country partially', async () => {
      const result = { id: 1, name: 'Argentina Patched', code: 'AR' };
      mockCountriesService.updatePatch.mockResolvedValue(result);

      const response = await controller.updatePatch(1, updateDto);

      expect(countriesService.updatePatch).toHaveBeenCalledWith(1, updateDto);
      expect(response).toEqual(result);
    });
  });

  describe('remove', () => {
    it('should remove a country', async () => {
      const result = { message: 'País con ID 1 eliminado correctamente.' };
      mockCountriesService.remove.mockResolvedValue(result);

      const response = await controller.remove(1);

      expect(countriesService.remove).toHaveBeenCalledWith(1);
      expect(response).toEqual(result);
    });
  });
});
