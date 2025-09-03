// src/province/interfaces/province.interfaces.ts

export interface ProvinceResponseDto {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: {
    id: number;
    name: string;
  };
}