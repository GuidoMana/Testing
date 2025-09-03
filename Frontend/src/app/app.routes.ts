import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { Registro } from './pages/registro/registro';
import { TablaDeDatos } from './pages/tabla-de-datos/tabla-de-datos';
import { CrearPersona } from './pages/crear-persona/crear-persona';
import { EditarPersonaComponent } from './pages/editar-persona/editar-persona';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: Registro },
  { path: 'home', component: HomeComponent },
  { path: 'TablaDeDatos', component: TablaDeDatos },
  { path: 'CrearPersona', component: CrearPersona },
  { path: 'EditarPersona/:id', component: EditarPersonaComponent }
];
