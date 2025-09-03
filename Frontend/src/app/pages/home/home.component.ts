import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {


  canShowAdminButtons = false;


  constructor(private authService: AuthService) { }

  ngOnInit(): void {
    // Cuando el componente se inicia, verificamos el rol
    const userRole = this.authService.getUserRole();
    if (userRole === 'admin' || userRole === 'moderator') {
      this.canShowAdminButtons = true;
    }
  }
}
