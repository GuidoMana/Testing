import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { PersonService } from './person.service';
import { Person, PersonRole } from '../entities/person.entity';
import { City } from '../entities/city.entity';
import { NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { CreatePersonDto } from '../dto/create-person.dto';
import { UpdatePatchPersonDto } from '../dto/update-patch-person.dto';
import { UpdatePutPersonDto } from '../dto/update-put-person.dto';
import { PaginationDto } from '../dto/pagination.dto';

describe('PersonService', () => {
  let service: PersonService;
  let personRepository: Repository<Person>;
  let cityRepository: Repository<City>;

  const mockPersonRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    preload: jest.fn(),
    delete: jest.fn(),
  };

  const mockCityRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        {
          provide: getRepositoryToken(Person),
          useValue: mockPersonRepository,
        },
        {
          provide: getRepositoryToken(City),
          useValue: mockCityRepository,
        },
      ],
    }).compile();

    service = module.get<PersonService>(PersonService);
    personRepository = module.get<Repository<Person>>(getRepositoryToken(Person));
    cityRepository = module.get<Repository<City>>(getRepositoryToken(City));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreatePersonDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'Password1!',
      cityId: 1,
      role: PersonRole.USER,
      birthDate: '1990-01-01',
    };

    it('should create a new person successfully', async () => {
      const city = { id: 1, name: 'CityName' };
      const person = { id: 1, ...createDto, city, cityId: 1 };
      const savedPerson = { ...person };
      const reloadedPerson = { ...person };

      mockPersonRepository.findOne.mockResolvedValueOnce(null); // email check
      mockCityRepository.findOne.mockResolvedValue(city);
      mockPersonRepository.create.mockReturnValue(person);
      mockPersonRepository.save.mockResolvedValue(savedPerson);
      mockPersonRepository.findOne.mockResolvedValueOnce(reloadedPerson); // reload

      const result = await service.create(createDto);

      expect(result.email).toEqual(createDto.email);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPersonRepository.findOne.mockResolvedValue(createDto);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if city not found', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);
      mockCityRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should create person without city', async () => {
      const dtoWithoutCity = { ...createDto, cityId: undefined };
      const person = { id: 1, ...dtoWithoutCity, city: null, cityId: null };
      const savedPerson = { ...person };
      const reloadedPerson = { ...person };

      mockPersonRepository.findOne.mockResolvedValueOnce(null); // email check
      mockPersonRepository.create.mockReturnValue(person);
      mockPersonRepository.save.mockResolvedValue(savedPerson);
      mockPersonRepository.findOne.mockResolvedValueOnce(reloadedPerson); // reload

      const result = await service.create(dtoWithoutCity);

      expect(result.cityId).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated persons', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const persons = [{ id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', city: null }];
      mockPersonRepository.findAndCount.mockResolvedValue([persons, 1]);

      const result = await service.findAll(paginationDto);

      expect(result.data.length).toBe(1);
      expect(result.meta.totalItems).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a person by id', async () => {
      const person = { id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', city: null };
      mockPersonRepository.findOne.mockResolvedValue(person);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if person not found', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmailForAuth', () => {
    it('should return person for auth', async () => {
      const person = { id: 1, email: 'john.doe@example.com', password: 'hashed', role: PersonRole.USER };
      mockPersonRepository.findOne.mockResolvedValue(person);

      const result = await service.findByEmailForAuth('john.doe@example.com');

      expect(result).toEqual(person);
    });

    it('should return null if not found', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmailForAuth('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a person partially', async () => {
      const updateDto: UpdatePatchPersonDto = { firstName: 'Jane' };
      const personToUpdate = { id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', city: null };
      const updatedPerson = { ...personToUpdate, ...updateDto };
      const reloadedPerson = { ...updatedPerson };

      mockPersonRepository.preload.mockResolvedValue(personToUpdate);
      mockPersonRepository.save.mockResolvedValue(updatedPerson);
      mockPersonRepository.findOne.mockResolvedValue(reloadedPerson);

      const result = await service.update(1, updateDto);

      expect(result.firstName).toBe('Jane');
    });

    it('should throw NotFoundException if person to update not found', async () => {
      mockPersonRepository.preload.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
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
      const person = { id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', city: null };
      const updatedPerson = { ...person, ...updateDto };
      const reloadedPerson = { ...updatedPerson };

      mockPersonRepository.findOneBy.mockResolvedValue(person);
      mockPersonRepository.findOne.mockResolvedValueOnce(null); // email check
      mockPersonRepository.save.mockResolvedValue(updatedPerson);
      mockPersonRepository.findOne.mockResolvedValue(reloadedPerson);

      const result = await service.updatePut(1, updateDto);

      expect(result.firstName).toBe('Jane');
      expect(result.email).toBe('jane.doe@example.com');
    });

    it('should throw NotFoundException if person to update not found', async () => {
      mockPersonRepository.findOneBy.mockResolvedValue(null);

      await expect(service.updatePut(999, {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a person successfully', async () => {
      mockPersonRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1);

      expect(result.message).toContain('eliminada correctamente');
    });

    it('should throw NotFoundException if person to remove not found', async () => {
      mockPersonRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByName', () => {
    it('should find persons by name', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const persons = [{ id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', city: null }];
      mockPersonRepository.findAndCount.mockResolvedValue([persons, 1]);

      const result = await service.findByName('John', paginationDto);

      expect(result.data.length).toBe(1);
      expect(result.meta.totalItems).toBe(1);
    });
  });
});
