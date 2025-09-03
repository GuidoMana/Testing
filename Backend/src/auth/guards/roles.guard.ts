// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PersonRole } from '../../entities/person.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PersonRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Asume que 'user' tiene una propiedad 'role' del tipo PersonRole

    if (!user || !user.role) {
      this.logger.warn('RolesGuard: Usuario no autenticado o sin rol definido.');
      throw new ForbiddenException('No tienes permiso para acceder a este recurso (usuario o rol no definido).');
    }

    const hasRequiredRole = requiredRoles.some((role) => user.role === role);

    if (hasRequiredRole) {
      return true;
    } else {
      this.logger.warn(`RolesGuard: Acceso denegado. Usuario con rol '${user.role}' no tiene roles requeridos: ${requiredRoles.join(', ')}.`);
      throw new ForbiddenException('No tienes los permisos necesarios para realizar esta acción.');
    }
  }
}