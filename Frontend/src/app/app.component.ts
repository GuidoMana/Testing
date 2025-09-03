import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, HeaderComponent],
  template: `
  <app-header></app-header>
  
  <main class="main-content">
    <router-outlet></router-outlet>
  </main>`,
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'pedidos-ya';
}
