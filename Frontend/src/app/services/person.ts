import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Person } from '../models/person.model';
import { PaginatedResponse } from '../models/pagination.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PersonsService {

  private readonly apiUrl = 'http://localhost:3001';
  private readonly endpoint = '/persons';

  constructor(private http: HttpClient, private authService: AuthService) { }

  private getAuthHeaders(): HttpHeaders | null {
    const token = this.authService.getToken();
    if (!token) {
      return null;
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getPersons(page: number, limit: number): Observable<PaginatedResponse<Person>> {
    const headers = this.getAuthHeaders();
    if (!headers) {
      return throwError(() => new Error('No se encontró el token de autenticación.'));
    }

    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<PaginatedResponse<Person>>(`${this.apiUrl}${this.endpoint}`, { headers, params })
      .pipe(
        catchError(err => {
          console.error('Ocurrió un error en getPersons:', err);
          return throwError(() => new Error('Error al obtener los datos de las personas.'));
        })
      );
  }

  getPersonById(id: number): Observable<Person> {
    const headers = this.getAuthHeaders();
    if (!headers) {
      return throwError(() => new Error('No se encontró el token de autenticación.'));
    }
    return this.http.get<Person>(`${this.apiUrl}${this.endpoint}/${id}`, { headers });
  }

  createPerson(personData: Omit<Person, 'id' | 'city'>): Observable<Person> {
    const headers = this.getAuthHeaders();
    if (!headers) {
      return throwError(() => new Error('No se encontró el token de autenticación.'));
    }
    return this.http.post<Person>(`${this.apiUrl}${this.endpoint}`, personData, { headers });
  }

  updatePerson(id: number, personData: Partial<Person>): Observable<Person> {
    const headers = this.getAuthHeaders();
    if (!headers) {
      return throwError(() => new Error('No se encontró el token de autenticación.'));
    }
    // Usamos PATCH para actualizaciones parciales, que es lo que hace nuestro formulario de edición.
    return this.http.patch<Person>(`${this.apiUrl}${this.endpoint}/${id}`, personData, { headers });
  }

  deletePerson(id: number): Observable<void> {
    const headers = this.getAuthHeaders();
    if (!headers) {
      return throwError(() => new Error('No se encontró el token de autenticación.'));
    }
    return this.http.delete<void>(`${this.apiUrl}${this.endpoint}/${id}`, { headers });
  }
}
