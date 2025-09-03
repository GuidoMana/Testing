// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { PersonRole } from '../../entities/person.entity';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: PersonRole[]) => SetMetadata(ROLES_KEY, roles);
