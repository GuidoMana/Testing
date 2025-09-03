// src/person/interfaces/person.interfaces.ts

export interface CountryResponse {
  id: number;
  name: string;
}

export interface ProvinceResponse {
  id: number;
  name: string;
  country?: CountryResponse | null;
}

export interface CityResponse {
  id: number;
  name: string;
  province?: ProvinceResponse | null;
}

export interface PersonResponseDto {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  birthDate: Date | null;
  role: string;
  city?: CityResponse | null;
  cityId: number | null;
}