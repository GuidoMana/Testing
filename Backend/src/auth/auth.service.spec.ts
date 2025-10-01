// src/auth/auth.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PersonService } from '../person/person.service';
import { JwtService } from '@nestjs/jwt';
import { CitiesService } from '../city/city.service';
import { UnauthorizedException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { RegisterPersonDto } from './dto/register-person.dto';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  ...jest.requireActual('bcrypt'), 
  hash: jest.fn(() => Promise.resolve('hashed-password')), 
  compare: jest.fn(), 
}));

describe('AuthService', () => {
  let authService: AuthService;
  let personsService: jest.Mocked<PersonService>;
  let citiesService: jest.Mocked<CitiesService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    // Creamos un módulo de prueba que simula nuestras dependencias
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PersonService,
          useValue: {
            findByEmailForAuth: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: CitiesService,
          useValue: {
            findOneByNameAndProvinceName: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    personsService = module.get(PersonService);
    citiesService = module.get(CitiesService);
    jwtService = module.get(JwtService);
  });

  // Limpiamos los mocks después de cada prueba para evitar interferencias
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Pruebas para el método de registro
  describe('register', () => {
    const registerDto: RegisterPersonDto = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      cityName: 'Buenos Aires',
      provinceName: 'CABA',
      birthDate: '1990-01-01',
    };

    it('debería registrar un nuevo usuario exitosamente', async () => {
      personsService.findByEmailForAuth.mockResolvedValue(null);
      // @ts-ignore
      citiesService.findOneByNameAndProvinceName.mockResolvedValue({ id: 1, name: 'Buenos Aires' });
      // @ts-ignore
      personsService.create.mockResolvedValue({ id: 100, email: registerDto.email });

      const result = await authService.register(registerDto);

      expect(result).toEqual({
        message: 'Usuario registrado exitosamente',
        userId: 100,
      });
      expect(personsService.create).toHaveBeenCalledWith(expect.objectContaining({
        password: 'hashed-password',
        cityId: 1,
      }));
    });

    it('debería lanzar ConflictException si el email ya existe', async () => {
      personsService.findByEmailForAuth.mockResolvedValue({ id: 1 } as any);
      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('debería lanzar BadRequestException si la ciudad no se encuentra', async () => {
      personsService.findByEmailForAuth.mockResolvedValue(null);
      citiesService.findOneByNameAndProvinceName.mockResolvedValue(null);
      await expect(authService.register(registerDto)).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar InternalServerErrorException si personsService.create falla', async () => {
      personsService.findByEmailForAuth.mockResolvedValue(null);
      // @ts-ignore
      citiesService.findOneByNameAndProvinceName.mockResolvedValue({ id: 1 });
      const dbError = new Error('Error de base de datos simulado');
      personsService.create.mockRejectedValue(dbError);

      await expect(authService.register(registerDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // Pruebas para el método de login
  describe('login', () => {
    const email = 'test@example.com';
    const password = 'Password123!';
    const mockPerson = {
      id: 1,
      email: email,
      password: 'hashed-password-from-db',
      role: 'USER',
      firstName: 'Test',
      lastName: 'User',
    };

    it('debería devolver un access_token cuando las credenciales son correctas', async () => {
      personsService.findByEmailForAuth.mockResolvedValue(mockPerson as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await authService.login(email, password);

      expect(result).toEqual({ access_token: 'mock-jwt-token' });
      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({
        sub: mockPerson.id,
        email: mockPerson.email,
      }));
    });

    it('debería lanzar UnauthorizedException si el email no existe', async () => {
      personsService.findByEmailForAuth.mockResolvedValue(null);
      await expect(authService.login(email, password)).rejects.toThrow(UnauthorizedException);
    });

    it('debería lanzar UnauthorizedException si la contraseña es incorrecta', async () => {
      personsService.findByEmailForAuth.mockResolvedValue(mockPerson as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(authService.login(email, password)).rejects.toThrow(UnauthorizedException);
    });
  });

  // Pruebas para el método de validación de credenciales
  describe('validatePersonCredentials', () => {
    const email = 'test@example.com';
    const pass = 'Password123!';
    const mockPerson = {
      id: 1,
      email: email,
      password: 'hashed-password-from-db',
      firstName: 'Test',
      // Simula el método que TypeORM añade a las entidades
      hashPassword: jest.fn(),
    };

    it('debería devolver los datos del usuario (sin password) si las credenciales son correctas', async () => {
      personsService.findByEmailForAuth.mockResolvedValue(mockPerson as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validatePersonCredentials(email, pass);

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('hashPassword');
      expect(result?.firstName).toEqual('Test');
    });

    it('debería devolver null si el email no existe', async () => {
      personsService.findByEmailForAuth.mockResolvedValue(null);
      const result = await authService.validatePersonCredentials(email, pass);
      expect(result).toBeNull();
    });

    it('debería devolver null si la contraseña es incorrecta', async () => {
      personsService.findByEmailForAuth.mockResolvedValue(mockPerson as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const result = await authService.validatePersonCredentials(email, pass);
      expect(result).toBeNull();
    });
  });
});