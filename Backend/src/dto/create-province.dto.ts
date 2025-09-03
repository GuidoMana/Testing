// src/province/dto/create-province.dto.ts
import { IsNotEmpty, IsString, MaxLength, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional } from 'class-validator';

export class CreateProvinceDto {
  @IsNotEmpty({ message: 'El nombre de la provincia no puede estar vacío.' })
  @IsString({ message: 'El nombre de la provincia debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El nombre de la provincia no debe exceder los 100 caracteres.' })
  name!: string;

  @IsNotEmpty({ message: 'El ID del país es requerido.' })
  @IsInt({ message: 'El ID del país debe ser un número entero.' })
  countryId!: number;

  @IsNotEmpty({ message: 'La latitud es requerida.' })
  @IsNumber({}, { message: 'La latitud debe ser un número.'})
  @IsLatitude({ message: 'Debe proporcionar una latitud válida.'})
  latitude!: number;

  @IsNotEmpty({ message: 'La longitud es requerida.' })
  @IsNumber({}, { message: 'La longitud debe ser un número.'})
  @IsLongitude({ message: 'Debe proporcionar una longitud válida.'})
  longitude!: number;
}