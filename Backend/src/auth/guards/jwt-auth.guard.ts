// src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si la ruta es pública (tiene el decorador @Public()), permitimos el acceso inmediatamente.
    if (isPublic) {
      return true;
    }

    // Si la ruta NO es pública, continuamos con la validación de JWT normal.
    // Llama al método canActivate de la clase base (AuthGuard('jwt'))
    // Este se encargará de ejecutar la lógica de la JwtStrategy.
    this.logger.debug('JwtAuthGuard: La ruta no es pública, procediendo a validar JWT...');
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: TUser, info: any, context: ExecutionContext, status?: any): TUser {
    if (err || !user) {
      this.logger.warn(`JwtAuthGuard: Autenticación fallida. Error: ${err}, Info: ${info?.message || info}`);
      throw err || new UnauthorizedException(info?.message || 'No estás autorizado para acceder a este recurso.');
    }
    this.logger.debug('JwtAuthGuard: Autenticación exitosa. Usuario adjuntado a la solicitud.');
    return user;
  }
}