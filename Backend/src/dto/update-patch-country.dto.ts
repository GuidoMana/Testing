// src/country/dto/update-patch-country.dto.ts 
import { PartialType } from '@nestjs/mapped-types';
import { CreateCountryDto } from '../dto/create-country.dto';

// UpdateCountryDto se usa para operaciones PATCH, donde todos los campos son opcionales.
export class UpdateCountryDto extends PartialType(CreateCountryDto) {}