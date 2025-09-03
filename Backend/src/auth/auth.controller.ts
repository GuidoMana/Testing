// src/auth/auth.controller.ts
import { Controller, Post, Body, Res, HttpCode, HttpStatus, UsePipes, ValidationPipe, Logger, Req, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { LoginDto } from './dto/login.dto';
import { RegisterPersonDto } from './dto/register-person.dto';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async register(@Body() registerPersonDto: RegisterPersonDto) {
    this.logger.log(`Intento de registro para el email: ${registerPersonDto.email}`);
    const result = await this.authService.register(registerPersonDto);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log(`Intento de login para: ${loginDto.email}`);
    const result = await this.authService.login(loginDto.email, loginDto.password);

    const expiresInMs = this.parseExpiresIn(this.configService.get<string>('JWT_EXPIRES_IN', '1h'));
    const cookieOptions = {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      expires: new Date(Date.now() + expiresInMs),
    };

    response.cookie('jwt', result.access_token, cookieOptions);
    this.logger.log(`Login exitoso para: ${loginDto.email}. Cookie establecida.`);
    return {
      message: 'Inicio de sesión exitoso.',
      accessToken: result.access_token
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) response: Response) {
    this.logger.log('Intento de logout.');
    const cookieOptions = {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
    };
    response.clearCookie('jwt', cookieOptions);
    this.logger.log('Logout exitoso. Cookie eliminada.');
    return { message: 'Sesión cerrada exitosamente.' };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@User() user: any) {
    this.logger.log(`Verificando estado de auth para usuario: ${JSON.stringify(user)}`);
    return { isAuthenticated: true, user: user };
  }

  private parseExpiresIn(expiresInString: string): number {
    const unit = expiresInString.charAt(expiresInString.length - 1);
    const value = parseInt(expiresInString.slice(0, -1), 10);
    if (isNaN(value)) return 3600 * 1000;

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default:
        const num = parseInt(expiresInString, 10);
        return isNaN(num) ? 3600 * 1000 : num * 1000;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@User() user: any) {
    return user;
  }
}