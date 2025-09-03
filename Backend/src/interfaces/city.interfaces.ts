// src/city/interfaces/city.interfaces.ts

export interface CityResponseDto {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  province: { 
    id: number;
    name: string;
    country?: {
        id: number;
        name: string;
    };
  };
}