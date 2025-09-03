import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { PersonsService } from '../../services/person';
import { Person } from '../../models/person.model';
import { PaginationMeta, PaginatedResponse } from '../../models/pagination.model';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-tabla-de-datos',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './tabla-de-datos.html',
  styleUrls: ['./tabla-de-datos.css']
})
export class TablaDeDatos implements OnInit {

  public persons: Person[] = [];
  public meta: PaginationMeta | null = null;
  public isLoading = true;
  public errorMessage: string | null = null;
  public selectedIds = new Set<number>();

  constructor(
    private personsService: PersonsService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadPersons(1);
  }

  deleteSelectedPersons(): void {
    if (this.selectedIds.size === 0) {
      alert('Por favor, seleccione al menos una persona para eliminar.');
      return;
    }

    if (confirm(`¿Está seguro de que desea eliminar ${this.selectedIds.size} persona(s)?`)) {
      const idsToDelete = Array.from(this.selectedIds);

      // Creamos un array de observables, uno por cada petición DELETE
      const deleteObservables = idsToDelete.map(id =>
        this.personsService.deletePerson(id).pipe(
          catchError(error => {
            // Si una petición falla, informamos y devolvemos un observable que no rompa el forkJoin
            console.error(`Error al eliminar persona con ID ${id}`, error);
            alert(`No se pudo eliminar la persona con ID ${id}.`);
            return of(null); // 'of(null)' permite que las otras eliminaciones continúen
          })
        )
      );

      // Usamos forkJoin para ejecutar todas las peticiones en paralelo
      forkJoin(deleteObservables).subscribe({
        next: () => {
          alert('Operación de eliminación completada.');
          // Recargamos la tabla para ver los cambios
          this.loadPersons(this.meta?.currentPage || 1);
        }
      });
    }
  }

  loadPersons(page: number, limit: number = 10): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.selectedIds.clear();

    this.personsService.getPersons(page, limit).subscribe({
      next: (response) => {
        this.persons = response.data;
        this.meta = response.meta;
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'No se pudieron cargar los datos. Verifique su conexión o sesión.';
        this.isLoading = false;
      }
    });
  }

  editSelectedPerson(): void {
    if (this.selectedIds.size !== 1) {
      alert('Por favor, seleccione una única persona para editar.');
      return;
    }
    const selectedId = this.selectedIds.values().next().value;
    this.router.navigate(['/EditarPersona', selectedId]);
  }

  toggleSelection(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  isAllSelected(): boolean {
    return this.persons.length > 0 && this.selectedIds.size === this.persons.length;
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedIds.clear();
    } else {
      this.persons.forEach(p => this.selectedIds.add(p.id));
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= (this.meta?.totalPages || 1)) {
      this.loadPersons(page);
    }
  }

  get paginationNumbers(): (number | string)[] {
    if (!this.meta) return [];
    const { currentPage, totalPages } = this.meta;
    const delta = 2, range = [], rangeWithDots: (number | string)[] = [];
    range.push(1);
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      if (!range.includes(i)) range.push(i);
    }
    if (totalPages > 1 && !range.includes(totalPages)) range.push(totalPages);
    let l: number | null = null;
    for (const i of range) {
      if (l !== null) {
        if (i - l === 2) rangeWithDots.push(l + 1);
        else if (i - l > 2) rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      l = i;
    }
    return rangeWithDots;
  }
}