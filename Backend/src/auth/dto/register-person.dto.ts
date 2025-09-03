// src/auth/dto/register-person.dto.ts
import { IsNotEmpty, IsString, IsEmail, MinLength, Matches, MaxLength, IsOptional, IsDateString, ValidateIf } from 'class-validator';


export class RegisterPersonDto {
  @IsNotEmpty({ message: 'El nombre no puede estar vacío.' })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El nombre no debe exceder los 50 caracteres.' })
  firstName!: string;

  @IsNotEmpty({ message: 'El apellido no puede estar vacío.' })
  @IsString({ message: 'El apellido debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El apellido no debe exceder los 50 caracteres.' })
  lastName!: string;

  @IsNotEmpty({ message: 'El email no puede estar vacío.' })
  @IsEmail({}, { message: 'El email debe ser una dirección de correo válida.' })
  @MaxLength(100, { message: 'El email no debe exceder los 100 caracteres.' })
  email!: string;

  @IsNotEmpty({ message: 'La contraseña no puede estar vacía.' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message: 'La contraseña debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial.',
  })
  password!: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida en formato YYYY-MM-DD.' })
  birthDate!: string;

  @IsString({ message: 'El nombre de la ciudad debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El nombre de la ciudad no debe exceder los 100 caracteres.' })
  cityName!: string;

  @ValidateIf(o => o.cityName !== undefined && o.cityName.trim() !== '')
  @IsString({ message: 'El nombre de la provincia debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El nombre de la provincia no debe exceder los 100 caracteres.' })
  provinceName!: string;
}