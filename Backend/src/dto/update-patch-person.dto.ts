// src/person/dto/update-patch-person.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreatePersonDto } from './create-person.dto';
import { IsString, IsOptional, MinLength, Matches } from 'class-validator';


export class UpdatePatchPersonDto extends PartialType(CreatePersonDto) {
  @IsOptional()
  @IsString({ message: 'La nueva contraseña debe ser una cadena de texto.' })
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message: 'La nueva contraseña debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial.',
  })
  newPassword?: string;
}