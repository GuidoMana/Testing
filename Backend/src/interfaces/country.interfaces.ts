// src/country/interfaces/country.interfaces.ts

export interface CountryResponseDto {
  id: number;
  name: string;
  code?: string | null;
}