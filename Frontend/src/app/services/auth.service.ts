// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = 'http://localhost:3001';
    private readonly TOKEN_KEY = 'access_token';

    private loggedIn = new BehaviorSubject<boolean>(this.hasToken());

    constructor(
        private http: HttpClient,
        private router: Router
    ) { }

    get isLoggedIn$(): Observable<boolean> {
        return this.loggedIn.asObservable();
    }

    private hasToken(): boolean {
        return !!localStorage.getItem(this.TOKEN_KEY);
    }

    register(userData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/auth/register`, userData);
    }

    login(credentials: any): Observable<{ accessToken: string }> {
        return this.http.post<{ accessToken: string }>(`${this.apiUrl}/auth/login`, credentials).pipe(
            tap(response => {
                if (response.accessToken) {
                    // Guardamos usando la clave estandarizada
                    localStorage.setItem(this.TOKEN_KEY, response.accessToken);
                    this.loggedIn.next(true);
                }
            })
        );
    }

    logout(): void {
        // Borramos usando la clave estandarizada
        localStorage.removeItem(this.TOKEN_KEY);
        this.loggedIn.next(false);
        this.router.navigate(['/login']);
    }

    getToken(): string | null {
        // Leemos usando la clave estandarizada
        return localStorage.getItem(this.TOKEN_KEY);
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }

    getUserRole(): string | null {
        const token = this.getToken();
        if (!token) { return null; }
        try {
            const decodedToken: any = jwtDecode(token);
            return decodedToken.role;
        } catch (error) {
            console.error("Error al decodificar el token", error);
            return null;
        }
    }

    getUserInfoFromToken(): any | null {
        const token = this.getToken();
        if (!token) return null;
        try {
            return jwtDecode(token);
        } catch (error) {
            return null;
        }
    }
}