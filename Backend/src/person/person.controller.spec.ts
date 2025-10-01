import { Test, TestingModule } from '@nestjs/testing';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PersonRole } from '../entities/person.entity';
import { CreatePersonDto } from '../dto/create-person.dto';
import { UpdatePutPersonDto } from '../dto/update-put-person.dto';
import { UpdatePatchPersonDto } from '../dto/update-patch-person.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { BadRequestException } from '@nestjs/common';

describe('PersonController', () => {
  let controller: PersonController;
  let service: PersonService;

  const mockPersonService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updatePut: jest.fn(),
    remove: jest.fn(),
    findByName: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonController],
      providers: [
        {
          provide: PersonService,
          useValue: mockPersonService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PersonController>(PersonController);
    service = module.get<PersonService>(PersonService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a person', async () => {
      const createDto: CreatePersonDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password1!',
        cityId: 1,
        role: PersonRole.USER,
        birthDate: '1990-01-01',
      };
      const result = { id: 1, ...createDto };

      mockPersonService.create.mockResolvedValue(result);

      const response = await controller.create(createDto);

      expect(response).toEqual(result);
      expect(mockPersonService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated persons', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const result = {
        data: [{ id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' }],
        meta: { totalItems: 1, itemCount: 1, itemsPerPage: 10, totalPages: 1, currentPage: 1 },
      };

      mockPersonService.findAll.mockResolvedValue(result);

      const response = await controller.findAll(paginationDto);

      expect(response).toEqual(result);
      expect(mockPersonService.findAll).toHaveBeenCalledWith(paginationDto);
    });
  });

  describe('searchByName', () => {
    it('should search persons by name', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10, name: 'John' };
      const result = {
        data: [{ id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' }],
        meta: { totalItems: 1, itemCount: 1, itemsPerPage: 10, totalPages: 1, currentPage: 1 },
      };

      mockPersonService.findByName.mockResolvedValue(result);

      const response = await controller.searchByName(paginationDto);

      expect(response).toEqual(result);
      expect(mockPersonService.findByName).toHaveBeenCalledWith('John', paginationDto);
    });

    it('should throw BadRequestException for empty name', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10, name: '' };

      await expect(controller.searchByName(paginationDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for undefined name', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };

      await expect(controller.searchByName(paginationDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a person by id', async () => {
      const result = { id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' };

      mockPersonService.findOne.mockResolvedValue(result);

      const response = await controller.findOne(1);

      expect(response).toEqual(result);
      expect(mockPersonService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('updatePut', () => {
    it('should update a person fully', async () => {
      const updateDto: UpdatePutPersonDto = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        role: PersonRole.USER,
      };
      const result = { id: 1, ...updateDto };

      mockPersonService.updatePut.mockResolvedValue(result);

      const response = await controller.updatePut(1, updateDto);

      expect(response).toEqual(result);
      expect(mockPersonService.updatePut).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('updatePatch', () => {
    it('should update a person partially', async () => {
      const updateDto: UpdatePatchPersonDto = { firstName: 'Jane' };
      const result = { id: 1, firstName: 'Jane', lastName: 'Doe', email: 'john.doe@example.com' };

      mockPersonService.update.mockResolvedValue(result);

      const response = await controller.updatePatch(1, updateDto);

      expect(response).toEqual(result);
      expect(mockPersonService.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('remove', () => {
    it('should remove a person', async () => {
      const result = { message: 'Persona eliminada correctamente' };

      mockPersonService.remove.mockResolvedValue(result);

      const response = await controller.remove(1);

      expect(response).toEqual(result);
      expect(mockPersonService.remove).toHaveBeenCalledWith(1);
    });
  });
});
