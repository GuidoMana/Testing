// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import { PersonService } from '../person/person.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Person } from '../entities/person.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RegisterPersonDto } from './dto/register-person.dto';
import { CitiesService } from '../city/city.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly personsService: PersonService,
    private readonly jwtService: JwtService,
    private readonly citiesService: CitiesService,
  ) { }

  async login(email: string, pass: string): Promise<{ access_token: string }> {
    this.logger.debug(`Procesando login para: ${email}`);
    const person = await this.personsService.findByEmailForAuth(email);

    if (!person) {
      this.logger.warn(`Login fallido: Email no encontrado - ${email}`);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const passwordIsValid = await bcrypt.compare(pass, person.password);
    if (!passwordIsValid) {
      this.logger.warn(`Login fallido: Contraseña incorrecta para - ${email}`);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const payload: JwtPayload = {
      sub: person.id,
      email: person.email,
      role: person.role,
      firstName: person.firstName,
      lastName: person.lastName
    };
    this.logger.log(`Login exitoso para: ${email}. Generando token.`);
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(registerPersonDto: RegisterPersonDto): Promise<{ message: string; userId: number }> {
    this.logger.debug(`Intentando registrar nueva persona con email: ${registerPersonDto.email}`);

    const { email, password, cityName, provinceName, ...personData } = registerPersonDto;

    const existingUser = await this.personsService.findByEmailForAuth(email);
    if (existingUser) {
      this.logger.warn(`Registro fallido: El email '${email}' ya está en uso.`);
      throw new ConflictException(`El email '${email}' ya está registrado.`);
    }

    let cityIdToAssign: number | undefined = undefined;
    if (cityName) {
      const city = await this.citiesService.findOneByNameAndProvinceName(cityName, provinceName);
      if (!city) {
        this.logger.warn(`Registro fallido: Ciudad '${cityName}' ${provinceName ? `en provincia '${provinceName}'` : ''} no encontrada.`);
        throw new BadRequestException(`La ciudad '${cityName}' ${provinceName ? `en la provincia '${provinceName}'` : ''} no fue encontrada.`);
      }
      cityIdToAssign = city.id;
      this.logger.log(`Ciudad encontrada para el registro: ID ${cityIdToAssign}, Nombre: ${city.name}`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    this.logger.debug(`Contraseña hasheada para el usuario ${email}`);

    try {
      const newUser = await this.personsService.create({
        ...personData,
        email,
        password: hashedPassword, // ¡Guardamos la contraseña hasheada!
        cityId: cityIdToAssign, // Asignamos la ciudad por su ID
      });

      this.logger.log(`Usuario registrado exitosamente con ID: ${newUser.id}`);
      return {
        message: 'Usuario registrado exitosamente',
        userId: newUser.id,
      };
    } catch (error) {
      if (error instanceof Error) {
        // Si entramos aquí, TypeScript ya sabe que 'error' tiene .stack, .message, etc.
        this.logger.error(
          'Error al intentar guardar el nuevo usuario en la base de datos.',
          error.stack, // ¡El error aquí desaparecerá!
        );
      } else {
        // Si lo que se "lanzó" no fue un Error, lo logueamos de forma genérica
        this.logger.error(
          'Se produjo un error inesperado al guardar el usuario.',
          error,
        );
      }
      throw new BadRequestException('No se pudo completar el registro, por favor intente de nuevo.');
    }
  }

  async validatePersonCredentials(email: string, pass: string): Promise<Omit<Person, 'password' | 'hashPassword'> | null> {
    const person = await this.personsService.findByEmailForAuth(email);
    if (person && await bcrypt.compare(pass, person.password)) {
      const { password, hashPassword, ...result } = person;
      return result as Omit<Person, 'password' | 'hashPassword'>;
    }
    return null;
  }
}