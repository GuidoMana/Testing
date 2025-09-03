import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { PersonsService } from '../../services/person';
import { Person } from '../../models/person.model';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { switchMap, tap, catchError, finalize } from 'rxjs/operators';
import { CountriesService } from '../../services/countries';
import { ProvincesService } from '../../services/provinces';
import { CitiesService } from '../../services/cities';
import { Country } from '../../models/country.model';
import { Province } from '../../models/province.model';
import { City } from '../../models/city.model';

@Component({
  selector: 'app-editar-persona',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './editar-persona.html',
  styleUrls: ['./editar-persona.css']
})
export class EditarPersonaComponent implements OnInit {
  editForm!: FormGroup;
  personId!: number;
  isLoading = true;
  errorMessage: string | null = null;

  // Estado para los desplegables
  countries: Country[] = [];
  provinces: Province[] = [];
  cities: City[] = [];
  isLoadingLocations = true;

  roles = [
    { value: 'user', label: 'Usuario' },
    { value: 'moderator', label: 'Moderador' },
    { value: 'admin', label: 'Admin' }
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private personsService: PersonsService,
    private countriesService: CountriesService,
    private provincesService: ProvincesService,
    private citiesService: CitiesService
  ) { }

  ngOnInit(): void {
    this.initializeForm();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.errorMessage = 'No se proporcionó un ID de persona.';
      this.isLoading = false;
      return;
    }
    this.personId = +idParam;

    this.loadPersonAndLocations();
  }

  initializeForm(): void {
    // Creamos el formulario con todos los campos, incluyendo los de localización
    this.editForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.minLength(6)]],
      role: ['user', Validators.required],
      birthDate: [''],
      countryId: [{ value: null, disabled: true }, Validators.required],
      provinceId: [{ value: null, disabled: true }, Validators.required],
      cityId: [{ value: null, disabled: true }, Validators.required]
    });
  }

  get f() { return this.editForm.controls; }

  loadPersonAndLocations(): void {
    this.personsService.getPersonById(this.personId).pipe(
      switchMap(person => {
        // Una vez que tenemos la persona, preparamos las llamadas para sus datos de localización
        const countryId = person.city?.province?.country?.id;
        const provinceId = person.city?.province?.id;

        // Si la persona no tiene ubicación, solo cargamos los países
        if (!countryId || !provinceId) {
          return forkJoin({
            person: of(person),
            countries: this.countriesService.getCountries(),
            provinces: of({ data: [] }), // Observable vacío para provincias
            cities: of({ data: [] })     // Observable vacío para ciudades
          });
        }

        return forkJoin({
          person: of(person),
          countries: this.countriesService.getCountries(),
          provinces: this.provincesService.getProvincesByCountry(countryId),
          cities: this.citiesService.getCitiesByProvince(provinceId)
        });
      }),
      tap(({ person, countries, provinces, cities }) => {
        // Rellenamos los arrays de los desplegables
        this.countries = countries.data;
        this.provinces = provinces.data;
        this.cities = cities.data;

        // Rellenamos el formulario con todos los datos
        const birthDate = person.birthDate ? new Date(person.birthDate).toISOString().split('T')[0] : null;
        this.editForm.patchValue({
          ...person,
          birthDate,
          countryId: person.city?.province?.country?.id,
          provinceId: person.city?.province?.id,
          cityId: person.city?.id
        });

        // Habilitamos los controles
        this.f['countryId'].enable();
        this.f['provinceId'].enable();
        this.f['cityId'].enable();

        // Configuramos los listeners para cambios AHORA que todo está cargado
        this.onCountryChanges();
        this.onProvinceChanges();

        this.isLoading = false;
        this.isLoadingLocations = false;
      }),
      catchError(err => {
        this.errorMessage = 'No se pudo cargar la información de la persona y su ubicación.';
        this.isLoading = false;
        this.isLoadingLocations = false;
        console.error(err);
        return of(null); // Detenemos la cadena de forma segura
      })
    ).subscribe();
  }

  onCountryChanges(): void {
    this.f['countryId'].valueChanges.subscribe(countryId => {
      // No reseteamos si es la carga inicial
      if (this.editForm.pristine) return;

      this.provinces = [];
      this.cities = [];
      this.f['provinceId'].reset({ value: null, disabled: true });
      this.f['cityId'].reset({ value: null, disabled: true });

      if (countryId) {
        this.provincesService.getProvincesByCountry(countryId).subscribe(response => {
          this.provinces = response.data;
          this.f['provinceId'].enable();
        });
      }
    });
  }

  onProvinceChanges(): void {
    this.f['provinceId'].valueChanges.subscribe(provinceId => {
      // No reseteamos si es la carga inicial
      if (this.editForm.pristine) return;

      this.cities = [];
      this.f['cityId'].reset({ value: null, disabled: true });

      if (provinceId) {
        this.citiesService.getCitiesByProvince(provinceId).subscribe(response => {
          this.cities = response.data;
          this.f['cityId'].enable();
        });
      }
    });
  }

  onSubmit(): void {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) {
      alert("El formulario es inválido. Por favor, revise los errores.");
      return;
    }

    const formData = this.editForm.getRawValue();
    if (!formData.password) {
      delete formData.password;
    }

    // Creamos el objeto limpio para enviar
    const personDataToSend = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      birthDate: formData.birthDate,
      cityId: formData.cityId
    };

    this.personsService.updatePerson(this.personId, personDataToSend).subscribe({
      next: () => {
        alert('¡Persona actualizada con éxito!');
        this.router.navigate(['/TablaDeDatos']);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage = err.error?.message || 'Ocurrió un error al actualizar.';
        alert(this.errorMessage);
      }
    });
  }
}