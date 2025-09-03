// src/app/services/country.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Country } from '../models/country.model';
import { PaginatedResponse } from '../models/paginated-response.model';

@Injectable({
  providedIn: 'root'
})
export class CountriesService {

  private readonly apiUrl = 'http://localhost:3001';
  private readonly endpoint = '/countries';

  constructor(private http: HttpClient) { }

  /**
   * Obtiene una lista de todos los países.
   */
  getCountries(): Observable<PaginatedResponse<Country>> {
    const fullUrl = `${this.apiUrl}${this.endpoint}`;
    return this.http.get<PaginatedResponse<Country>>(fullUrl);
  }

  getCountryById(id: number): Observable<Country> {
    return this.http.get<Country>(`${this.apiUrl}${this.endpoint}/${id}`);
  }

  createCountry(countryData: Omit<Country, 'id' | 'provinces'>): Observable<Country> {
    return this.http.post<Country>(`${this.apiUrl}${this.endpoint}`, countryData);
  }

  updateCountry(id: number, countryData: Partial<Omit<Country, 'id' | 'provinces'>>): Observable<Country> {
    return this.http.put<Country>(`${this.apiUrl}${this.endpoint}/${id}`, countryData);
  }

  deleteCountry(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${this.endpoint}/${id}`);
  }
}