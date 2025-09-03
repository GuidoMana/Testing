// src/city/dto/create-city.dto.ts
import { IsNotEmpty, IsString, IsInt, MaxLength, IsOptional, IsLatitude, IsLongitude, IsNumber } from 'class-validator';

export class CreateCityDto {
  @IsNotEmpty({ message: 'El nombre de la ciudad no puede estar vacío.' })
  @IsString({ message: 'El nombre de la ciudad debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El nombre de la ciudad no debe exceder los 100 caracteres.' })
  name!: string;

  @IsNotEmpty({ message: 'El ID de la provincia es requerido.' })
  @IsInt({ message: 'El ID de la provincia debe ser un número entero.' })
  provinceId!: number;

  @IsNotEmpty({ message: 'La latitud es requerida.' })
  @IsNumber({}, { message: 'La latitud debe ser un número.' })
  @IsLatitude({ message: 'Debe proporcionar una latitud válida.' })
  latitude!: number;

  @IsNotEmpty({ message: 'La longitud es requerida.' })
  @IsNumber({}, { message: 'La longitud debe ser un número.' })
  @IsLongitude({ message: 'Debe proporcionar una longitud válida.' })
  longitude!: number;
}