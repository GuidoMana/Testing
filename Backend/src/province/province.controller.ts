// src/province/province.controller.ts
import {
  Controller, Get, Post, Body, Put, Patch, Param, Delete,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Logger, Query, BadRequestException
} from '@nestjs/common';
import { ProvincesService } from './province.service';
import { CreateProvinceDto } from '../dto/create-province.dto';
import { UpdateProvinceDto } from '../dto/update-patch-province.dto';
import { UpdatePutProvinceDto } from '../dto/update-put-province.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PersonRole } from '../entities/person.entity';
import { ProvinceResponseDto } from '../interfaces/province.interfaces';

import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('provinces')
@UseGuards(JwtAuthGuard)
export class ProvincesController {
  private readonly logger = new Logger(ProvincesController.name);

  constructor(private readonly provincesService: ProvincesService) { }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProvinceDto: CreateProvinceDto): Promise<ProvinceResponseDto> {
    this.logger.log(`Recibida solicitud para crear provincia: ${JSON.stringify(createProvinceDto)}`);
    return this.provincesService.create(createProvinceDto, false) as Promise<ProvinceResponseDto>;
  }

  @Public()
  @Get()
  findAll(@Query() paginationDto: PaginationDto): Promise<PaginatedResponseDto<ProvinceResponseDto>> {
    this.logger.log(`Recibida solicitud para obtener todas las provincias con paginación: ${JSON.stringify(paginationDto)}`);
    return this.provincesService.findAll(paginationDto);
  }

  @Get('search')
  async searchByName(
    @Query() paginationDto: PaginationDto
  ): Promise<PaginatedResponseDto<ProvinceResponseDto>> {
    const name = paginationDto.name; // Obtiene 'name' del DTO de paginación
    this.logger.log(`Buscando provincias por nombre: ${name} con paginación: ${JSON.stringify(paginationDto)}`);

    if (!name || name.trim() === '') {
      throw new BadRequestException('El término de búsqueda "name" no puede estar vacío para esta operación.');
    }
    return this.provincesService.searchByName(name, paginationDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ProvinceResponseDto> {
    this.logger.log(`Recibida solicitud para obtener provincia con ID: ${id}`);
    return this.provincesService.findOne(id, false) as Promise<ProvinceResponseDto>;
  }

  @Public() // Para que sea accesible sin login
  @Get('by-country/:countryId')
  findProvincesByCountry(@Param('countryId', ParseIntPipe) countryId: number) {
    this.logger.log(`Recibida solicitud para obtener provincias del país con ID: ${countryId}`);
    return this.provincesService.findByCountry(countryId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePutProvinceDto: UpdatePutProvinceDto,
  ): Promise<ProvinceResponseDto> {
    this.logger.log(`Recibida solicitud PUT para reemplazar provincia ID: ${id}`);
    return this.provincesService.updatePut(id, updatePutProvinceDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  updatePatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePatchProvinceDto: UpdateProvinceDto,
  ): Promise<ProvinceResponseDto> {
    this.logger.log(`Recibida solicitud PATCH para actualizar provincia ID: ${id}`);
    return this.provincesService.updatePatch(id, updatePatchProvinceDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Recibida solicitud para eliminar provincia ID: ${id}`);
    return this.provincesService.remove(id);
  }
}