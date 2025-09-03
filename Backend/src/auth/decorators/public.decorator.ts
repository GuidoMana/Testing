// src/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
// Esta es la "llave" que usamos para identificar los endpoints públicos.
export const IS_PUBLIC_KEY = 'isPublic';
// Este es el decorador @Public()
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);