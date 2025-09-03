// src/app/services/city.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { City } from '../models/city.model';
import { PaginatedResponse } from '../models/paginated-response.model';

@Injectable({
    providedIn: 'root'
})
export class CitiesService {

    private readonly apiUrl = 'http://localhost:3001';
    private readonly endpoint = '/cities';

    constructor(private http: HttpClient) { }

    /**
     * Obtiene una lista de todas las ciudades.
     */
    getCities(): Observable<City[]> {
        return this.http.get<City[]>(`${this.apiUrl}${this.endpoint}`);
    }

    getCityById(id: number): Observable<City> {
        return this.http.get<City>(`${this.apiUrl}${this.endpoint}/${id}`);
    }

    getCitiesByProvince(provinceId: number): Observable<PaginatedResponse<City>> {
        const url = `${this.apiUrl}${this.endpoint}/by-province/${provinceId}`;
        return this.http.get<PaginatedResponse<City>>(url);
    }

    createCity(cityData: Omit<City, 'id' | 'province' | 'persons'>): Observable<City> {
        return this.http.post<City>(`${this.apiUrl}${this.endpoint}`, cityData);
    }

    updateCity(id: number, cityData: Partial<Omit<City, 'id' | 'province' | 'persons'>>): Observable<City> {
        return this.http.put<City>(`${this.apiUrl}${this.endpoint}/${id}`, cityData);
    }

    deleteCity(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}${this.endpoint}/${id}`);
    }
}