// src/app/components/header/header.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Observable, map } from 'rxjs';

interface UserInfo {
  name: string;
  role: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {

  isLoggedIn$: Observable<boolean>;
  userInfo$: Observable<UserInfo | null>;

  constructor(private authService: AuthService, private router: Router) {
    this.isLoggedIn$ = this.authService.isLoggedIn$;

    this.userInfo$ = this.isLoggedIn$.pipe(
      map(isLoggedIn => {
        if (isLoggedIn) {
          const tokenInfo = this.authService.getUserInfoFromToken();
          return tokenInfo ? { name: `${tokenInfo.firstName} ${tokenInfo.lastName}`, role: tokenInfo.role } : null;
        }
        return null;
      })
    );
  }

  logout(): void {
    this.authService.logout();
  }
}
