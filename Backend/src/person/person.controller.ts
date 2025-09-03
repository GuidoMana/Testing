// src/person/person.controller.ts
import {
  Controller, Get, Post, Body, Put, Patch, Param, Delete,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Logger, Query, Req, BadRequestException
} from '@nestjs/common';
import { PersonService } from './person.service';
import { CreatePersonDto } from '../dto/create-person.dto';
import { UpdatePutPersonDto } from '../dto/update-put-person.dto';
import { UpdatePatchPersonDto } from '../dto/update-patch-person.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PersonRole } from '../entities/person.entity';
import { PersonResponseDto } from '../interfaces/person.interfaces';

import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

@Controller('persons')
@UseGuards(JwtAuthGuard)
export class PersonController {
  private readonly logger = new Logger(PersonController.name);

  constructor(private readonly personService: PersonService) { }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPersonDto: CreatePersonDto): Promise<PersonResponseDto> {
    this.logger.log(`Creando persona: ${createPersonDto.email}`);
    return this.personService.create(createPersonDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN, PersonRole.MODERATOR)
  findAll(@Query() paginationDto: PaginationDto): Promise<PaginatedResponseDto<PersonResponseDto>> {
    this.logger.log(`Buscando todas las personas con paginación: ${JSON.stringify(paginationDto)}`);
    return this.personService.findAll(paginationDto);
  }

  @Get('search')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN, PersonRole.MODERATOR)
  async searchByName(
    @Query() paginationDto: PaginationDto // NUEVO: ahora todos los params de búsqueda van en paginationDto
  ): Promise<PaginatedResponseDto<PersonResponseDto>> {
    const name = paginationDto.name; // Obtiene 'name' del DTO de paginación
    this.logger.log(`Buscando personas por nombre: ${name} con paginación: ${JSON.stringify(paginationDto)}`);
    if (!name || name.trim() === '') {
      // Si el término de búsqueda está vacío, devuelve una respuesta paginada vacía
      throw new BadRequestException('El término de búsqueda "name" no puede estar vacío para esta operación.');
    }
    return this.personService.findByName(name, paginationDto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN, PersonRole.MODERATOR)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PersonResponseDto> {
    this.logger.log(`Buscando persona ID: ${id}`);
    return this.personService.findOne(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePutPersonDto: UpdatePutPersonDto,
  ): Promise<PersonResponseDto> {
    this.logger.log(`Actualizando (PUT) persona ID: ${id}`);
    return this.personService.updatePut(id, updatePutPersonDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  updatePatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePatchPersonDto: UpdatePatchPersonDto,
  ): Promise<PersonResponseDto> {
    this.logger.log(`Actualizando (PATCH) persona ID: ${id}`);
    return this.personService.update(id, updatePatchPersonDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(PersonRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    this.logger.log(`Eliminando persona ID: ${id}`);
    return this.personService.remove(id);
  }
}