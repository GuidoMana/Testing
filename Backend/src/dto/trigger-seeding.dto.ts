// src/database/data-seeding/dto/trigger-seeding.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class TriggerSeedingDto {
  @IsNotEmpty({ message: 'La contraseña de administrador de siembra no puede estar vacía.' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  adminPassword!: string;
}