// src/common/dto/pagination.dto.ts
import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero.' })
  @Min(1, { message: 'La página debe ser al menos 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero.' })
  @Min(1, { message: 'El límite debe ser al menos 1.' })
  @Max(100, { message: 'El límite no puede exceder 100 elementos por página para evitar sobrecarga.' })
  limit?: number = 10;

  @IsOptional()
  @IsString({ message: 'El campo de ordenamiento (sortBy) debe ser una cadena de texto.' })
  sortBy?: string;

  @IsOptional()
  @IsString({ message: 'El orden de ordenamiento (sortOrder) debe ser una cadena de texto.' })
  @IsIn(['ASC', 'DESC', 'asc', 'desc'], { message: 'El orden de ordenamiento debe ser "ASC" o "DESC".' })
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'ASC';

  @IsOptional()
  @IsString({ message: 'El término de búsqueda (name) debe ser una cadena de texto.' })
  name?: string;
}