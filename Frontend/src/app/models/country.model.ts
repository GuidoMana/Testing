// src/app/models/country.model.ts
import { Province } from './province.model';

export interface Country {
    id: number;
    name: string;
    code: string | null;
    provinces?: Province[];
}