// src/app/services/provinces.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Province } from '../models/province.model';
import { PaginatedResponse } from '../models/paginated-response.model';

@Injectable({
  providedIn: 'root'
})
export class ProvincesService {

  private readonly apiUrl = 'http://localhost:3001';
  private readonly endpoint = '/provinces';

  constructor(private http: HttpClient) { }

  /**
   * Obtiene una lista de todas las provincias.
   */
  getProvinces(): Observable<Province[]> {
    return this.http.get<Province[]>(`${this.apiUrl}${this.endpoint}`);
  }

  getProvinceById(id: number): Observable<Province> {
    return this.http.get<Province>(`${this.apiUrl}${this.endpoint}/${id}`);
  }

  getProvincesByCountry(countryId: number): Observable<PaginatedResponse<Province>> {
    const url = `${this.apiUrl}${this.endpoint}/by-country/${countryId}`;
    return this.http.get<PaginatedResponse<Province>>(url);
  }

  createProvince(provinceData: Omit<Province, 'id' | 'country' | 'cities'>): Observable<Province> {
    return this.http.post<Province>(`${this.apiUrl}${this.endpoint}`, provinceData);
  }

  updateProvince(id: number, provinceData: Partial<Omit<Province, 'id' | 'country' | 'cities'>>): Observable<Province> {
    return this.http.put<Province>(`${this.apiUrl}${this.endpoint}/${id}`, provinceData);
  }

  deleteProvince(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${this.endpoint}/${id}`);
  }
}
