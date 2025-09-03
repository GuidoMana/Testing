// src/city/city.controller.ts
import {
  Controller, Get, Post, Body, Put, Patch, Param, Delete,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Logger, Query, BadRequestException
} from '@nestjs/common';
import { CitiesService } from './city.service';
import { CreateCityDto } from '../dto/create-city.dto';
import { UpdateCityDto } from '../dto/update-patch-city.dto';
import { UpdatePutCityDto } from '../dto/update-put-city.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PersonRole } from '../entities/person.entity';
import { CityResponseDto } from '../interfaces/city.interfaces';

import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('cities')
@UseGuards(JwtAuthGuard)
export class CitiesController {
  private readonly logger = new Logger(CitiesController.name);

  constructor(private readonly citiesService: CitiesService) { }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCityDto: CreateCityDto): Promise<CityResponseDto> {
    this.logger.log(`Recibida solicitud para crear ciudad: ${JSON.stringify(createCityDto)}`);
    return this.citiesService.create(createCityDto, false) as Promise<CityResponseDto>;
  }

  @Public()
  @Get()
  findAll(@Query() paginationDto: PaginationDto): Promise<PaginatedResponseDto<CityResponseDto>> {
    this.logger.log(`Recibida solicitud para obtener todas las ciudades con paginación: ${JSON.stringify(paginationDto)}`);
    return this.citiesService.findAll(paginationDto);
  }

  @Public()
  @Get('by-province/:provinceId')
  findCitiesByProvince(@Param('provinceId', ParseIntPipe) provinceId: number) {
    // Llama al método correspondiente en el servicio de ciudades
    return this.citiesService.findByProvince(provinceId);
  }

  @Get('search')
  async searchByName(
    @Query() paginationDto: PaginationDto
  ): Promise<PaginatedResponseDto<CityResponseDto>> {
    const name = paginationDto.name;
    this.logger.log(`Buscando ciudades por nombre: ${name} con paginación: ${JSON.stringify(paginationDto)}`);

    if (!name || name.trim() === '') {
      throw new BadRequestException('El término de búsqueda "name" no puede estar vacío para esta operación.');
    }
    return this.citiesService.searchByName(name, paginationDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<CityResponseDto> {
    this.logger.log(`Recibida solicitud para obtener ciudad con ID: ${id}`);
    return this.citiesService.findOne(id, false) as Promise<CityResponseDto>;
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePutCityDto: UpdatePutCityDto,
  ): Promise<CityResponseDto> {
    this.logger.log(`Recibida solicitud PUT para reemplazar ciudad ID: ${id}`);
    return this.citiesService.updatePut(id, updatePutCityDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  updatePatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePatchCityDto: UpdateCityDto,
  ): Promise<CityResponseDto> {
    this.logger.log(`Recibida solicitud PATCH para actualizar ciudad ID: ${id}`);
    return this.citiesService.updatePatch(id, updatePatchCityDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Recibida solicitud para eliminar ciudad ID: ${id}`);
    return this.citiesService.remove(id);
  }
}