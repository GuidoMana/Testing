// src/app/models/city.model.ts
import { Province } from './province.model';
import { Person } from './person.model';

export interface City {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    provinceId: number;

    province?: Province;
    persons?: Person[];
}