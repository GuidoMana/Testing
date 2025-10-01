import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterPersonDto } from './dto/register-person.dto';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let configService: jest.Mocked<ConfigService>;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
  });

  it('debe ser definido', () => {
    expect(controller).toBeDefined();
  });

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
      const result = { message: 'Usuario registrado exitosamente', userId: 1 };
      mockAuthService.register.mockResolvedValue(result);

      const response = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(response).toEqual(result);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('debe iniciar sesión correctamente y configurar las cookies.', async () => {
      const authResult = { access_token: 'jwt-token' };
      mockAuthService.login.mockResolvedValue(authResult);
      mockConfigService.get.mockReturnValue('1h');

      const mockResponse = {
        cookie: jest.fn(),
      } as any as Response;

      const result = await controller.login(loginDto, mockResponse);

      expect(authService.login).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(mockResponse.cookie).toHaveBeenCalledWith('jwt', 'jwt-token', expect.any(Object));
      expect(result).toEqual({
        message: 'Inicio de sesión exitoso.',
        accessToken: 'jwt-token'
      });
    });

    it('debería establecer una cookie segura en producción', async () => {
      mockAuthService.login.mockResolvedValue({ access_token: 'jwt-token' });
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRES_IN') return '1h';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      });

      const mockResponse = {
        cookie: jest.fn(),
      } as any as Response;

      await controller.login(loginDto, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledWith('jwt', 'jwt-token', expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      }));
    });
  });

  describe('logout', () => {
    it('debería borrar las cookies y devolver un mensaje de éxito.', async () => {
      mockConfigService.get.mockReturnValue('development');

      const mockResponse = {
        clearCookie: jest.fn(),
      } as any as Response;

      const result = await controller.logout(mockResponse);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('jwt', expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      }));
      expect(result).toEqual({ message: 'Sesión cerrada exitosamente.' });
    });
  });

  describe('status', () => {
    it('debería devolver el estado de autenticación', () => {
      const mockUser = { id: 1, email: 'test@example.com' };

      const result = controller.status(mockUser);

      expect(result).toEqual({ isAuthenticated: true, user: mockUser });
    });
  });

  describe('getProfile', () => {
    it('debería devolver el perfil de usuario', () => {
      const mockUser = { id: 1, email: 'test@example.com', firstName: 'Test' };

      const result = controller.getProfile(mockUser);

      expect(result).toEqual(mockUser);
    });
  });

  describe('parseExpiresIn', () => {
    it('debe manejar cadenas numéricas y devolver milisegundos.', () => {
      const result = (controller as any).parseExpiresIn('3600');
      expect(result).toBe(3600000);
    });

    it('debe devolver 1 hora en milisegundos si la cadena no es válida', () => {
      const result = (controller as any).parseExpiresIn('invalid-string');
      expect(result).toBe(3600 * 1000);
    });

    it('debería manejar la unidad "d" para días', () => {
      const result = (controller as any).parseExpiresIn('2d');
      expect(result).toBe(2 * 24 * 60 * 60 * 1000);
    });

    it('debería manejar la unidad "h" para horas', () => {
      const result = (controller as any).parseExpiresIn('2h');
      expect(result).toBe(2 * 60 * 60 * 1000);
    });

    it('debería manejar la unidad "m" para minutos', () => {
      const result = (controller as any).parseExpiresIn('30m');
      expect(result).toBe(30 * 60 * 1000);
    });

    it('debería manejar la unidad "s" para segundos', () => {
      const result = (controller as any).parseExpiresIn('90s');
      expect(result).toBe(90 * 1000);
    });
  });
});
