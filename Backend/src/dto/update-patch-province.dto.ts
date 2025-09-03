// src/provinces/dto/update-patch-province.dto.ts 
import { PartialType } from '@nestjs/mapped-types';
import { CreateProvinceDto } from '../dto/create-province.dto';

// UpdateProvinceDto se usa para operaciones PATCH, donde todos los campos son opcionales.
export class UpdateProvinceDto extends PartialType(CreateProvinceDto) {}