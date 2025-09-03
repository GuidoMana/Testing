// src/person/person.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../entities/person.entity';
import { PersonService } from './person.service';
import { PersonController } from './person.controller';
import { AuthModule } from '../auth/auth.module';
import { City } from '../entities/city.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Person, City]),
    forwardRef(() => AuthModule),
  ],
  controllers: [PersonController],
  providers: [PersonService],
  exports: [PersonService, TypeOrmModule.forFeature([Person])],
})
export class PersonsModule { }