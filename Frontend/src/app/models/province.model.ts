// src/app/models/province.model.ts
import { Country } from './country.model';
import { City } from './city.model';

export interface Province {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    countryId: number;
    country?: Country;
    cities?: City[];
}