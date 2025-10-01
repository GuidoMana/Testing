import { Test, TestingModule } from '@nestjs/testing';
import { ProvincesController } from './province.controller';
import { ProvincesService } from './province.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PersonRole } from '../entities/person.entity';
import { CreateProvinceDto } from '../dto/create-province.dto';
import { UpdatePutProvinceDto } from '../dto/update-put-province.dto';
import { UpdateProvinceDto } from '../dto/update-patch-province.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { BadRequestException } from '@nestjs/common';

describe('ProvincesController', () => {
  let controller: ProvincesController;
  let service: ProvincesService;

  const mockProvincesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    searchByName: jest.fn(),
    findOne: jest.fn(),
    findByCountry: jest.fn(),
    updatePut: jest.fn(),
    updatePatch: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProvincesController],
      providers: [
        {
          provide: ProvincesService,
          useValue: mockProvincesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProvincesController>(ProvincesController);
    service = module.get<ProvincesService>(ProvincesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a province', async () => {
      const dto: CreateProvinceDto = { name: 'Buenos Aires', countryId: 1, latitude: -34.6, longitude: -58.3 };
      mockProvincesService.create.mockResolvedValue(dto);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto, false);
      expect(result).toEqual(dto);
    });
  });

  describe('findAll', () => {
    it('should return paginated provinces', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const result = { data: [], meta: { totalItems: 0, currentPage: 1, itemsPerPage: 10 } };
      mockProvincesService.findAll.mockResolvedValue(result);

      expect(await controller.findAll(paginationDto)).toEqual(result);
    });
  });

  describe('searchByName', () => {
    it('should search provinces by name', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10, name: 'Buenos' };
      const result = { data: [], meta: { totalItems: 0, currentPage: 1, itemsPerPage: 10 } };
      mockProvincesService.searchByName.mockResolvedValue(result);

      expect(await controller.searchByName(paginationDto)).toEqual(result);
    });

    it('should throw BadRequestException if name is empty', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10, name: '' };

      await expect(controller.searchByName(paginationDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a province by id', async () => {
      const province = { id: 1, name: 'Buenos Aires' };
      mockProvincesService.findOne.mockResolvedValue(province);

      expect(await controller.findOne(1)).toEqual(province);
    });
  });

  describe('findProvincesByCountry', () => {
    it('should return provinces by country', async () => {
      const provinces = [{ id: 1, name: 'Buenos Aires' }];
      mockProvincesService.findByCountry.mockResolvedValue(provinces);

      expect(await controller.findProvincesByCountry(1)).toEqual(provinces);
    });
  });

  describe('updatePut', () => {
    it('should update a province fully', async () => {
      const updateDto: UpdatePutProvinceDto = { name: 'Updated', countryId: 1, latitude: -34, longitude: -58 };
      mockProvincesService.updatePut.mockResolvedValue(updateDto);

      expect(await controller.updatePut(1, updateDto)).toEqual(updateDto);
    });
  });

  describe('updatePatch', () => {
    it('should update a province partially', async () => {
      const updateDto: UpdateProvinceDto = { name: 'Patched' };
      mockProvincesService.updatePatch.mockResolvedValue(updateDto);

      expect(await controller.updatePatch(1, updateDto)).toEqual(updateDto);
    });
  });

  describe('remove', () => {
    it('should remove a province', async () => {
      const message = { message: 'Provincia eliminada correctamente' };
      mockProvincesService.remove.mockResolvedValue(message);

      expect(await controller.remove(1)).toEqual(message);
    });
  });
});
