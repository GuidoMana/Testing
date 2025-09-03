// src/app/models/person.model.ts
export interface Country {
    id: number;
    name: string;
}

export interface Province {
    id: number;
    name: string;
    country?: Country | null;
}

export interface City {
    id: number;
    name: string;
    province?: Province | null;
}

export interface Person {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    birthDate: string | null;
    role: string;
    city?: City | null;
    cityId: number | null;
}