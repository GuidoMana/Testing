//src/auth/auth.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      // Mockeamos los servicios que inyecta el controller
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('parseExpiresIn', () => {
    it('debería manejar un string numérico (ej. "3600") y devolver milisegundos', () => {
      // Truco para acceder a un método privado en tests
      const result = (controller as any).parseExpiresIn('3600');
      expect(result).toBe(3600000);
    });

    it('debería devolver 1 hora en milisegundos si el string es inválido', () => {
      const result = (controller as any).parseExpiresIn('invalid-string');
      expect(result).toBe(3600 * 1000);
    });
    
    it('debería manejar la unidad "d" para días', () => {
      const result = (controller as any).parseExpiresIn('2d');
      expect(result).toBe(2 * 24 * 60 * 60 * 1000);
    });
  });
});