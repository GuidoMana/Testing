import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { PersonsService } from '../../services/person';
import { HttpErrorResponse } from '@angular/common/http';

// Importamos los modelos y servicios de localización
import { CountriesService } from '../../services/countries';
import { ProvincesService } from '../../services/provinces';
import { CitiesService } from '../../services/cities';
import { Country } from '../../models/country.model';
import { Province } from '../../models/province.model';
import { City } from '../../models/city.model';
import { catchError, finalize, of, tap } from 'rxjs';


@Component({
  selector: 'app-crear-persona',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './crear-persona.html',
  styleUrls: ['./crear-persona.css']
})
export class CrearPersona implements OnInit {
  createForm!: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  public backUrl: string = '/home';

  // Arrays para los datos de los desplegables
  countries: Country[] = [];
  provinces: Province[] = [];
  cities: City[] = [];

  // Banderas para los spinners de carga
  isLoadingCountries = false;
  isLoadingProvinces = false;
  isLoadingCities = false;

  roles = [
    { value: 'user', label: 'Usuario' },
    { value: 'moderator', label: 'Moderador' },
    { value: 'admin', label: 'Admin' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private personsService: PersonsService,
    private countriesService: CountriesService,
    private provincesService: ProvincesService,
    private citiesService: CitiesService
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['from']) {
        this.backUrl = params['from'];
      }
    });
    this.createForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['user', Validators.required],
      birthDate: [''],
      countryId: [{ value: null, disabled: true }, Validators.required],
      provinceId: [{ value: null, disabled: true }, Validators.required],
      cityId: [{ value: null, disabled: true }, Validators.required]
    });

    this.loadCountries();
    this.onCountryChanges();
    this.onProvinceChanges();
  }

  get f() { return this.createForm.controls; }

  loadCountries(): void {
    this.isLoadingCountries = true;
    this.countriesService.getCountries().pipe(
      tap(response => {
        this.countries = response.data;
        this.f['countryId'].enable();
      }),
      catchError(error => {
        console.error('Error al cargar países', error);
        return of({ data: [] });
      }),
      finalize(() => { this.isLoadingCountries = false; })
    ).subscribe();
  }

  onCountryChanges(): void {
    this.f['countryId'].valueChanges.subscribe(countryId => {
      this.provinces = [];
      this.cities = [];
      this.f['provinceId'].reset({ value: null, disabled: true });
      this.f['cityId'].reset({ value: null, disabled: true });

      if (countryId) {
        this.isLoadingProvinces = true;
        this.provincesService.getProvincesByCountry(countryId).pipe(
          tap(response => {
            this.provinces = response.data;
            this.f['provinceId'].enable();
          }),
          catchError(error => {
            console.error('Error al cargar provincias', error);
            return of({ data: [] });
          }),
          finalize(() => { this.isLoadingProvinces = false; })
        ).subscribe();
      }
    });
  }

  onProvinceChanges(): void {
    this.f['provinceId'].valueChanges.subscribe(provinceId => {
      this.cities = [];
      this.f['cityId'].reset({ value: null, disabled: true });

      if (provinceId) {
        this.isLoadingCities = true;
        this.citiesService.getCitiesByProvince(provinceId).pipe(
          tap(response => {
            this.cities = response.data;
            this.f['cityId'].enable();
          }),
          catchError(error => {
            console.error('Error al cargar ciudades', error);
            return of({ data: [] });
          }),
          finalize(() => { this.isLoadingCities = false; })
        ).subscribe();
      }
    });
  }

  onSubmit(): void {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) {
      alert("El formulario es inválido. Por favor, revise los campos marcados.");
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    // Obtenemos todos los valores del formulario
    const formValue = this.createForm.getRawValue();

    const personDataToSend = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      password: formValue.password,
      role: formValue.role,
      birthDate: formValue.birthDate,
      cityId: formValue.cityId
    };

    // Enviamos el objeto limpio al servicio
    this.personsService.createPerson(personDataToSend).subscribe({
      next: (newPerson) => {
        this.isLoading = false;
        alert(`¡Persona "${newPerson.firstName} ${newPerson.lastName}" creada con éxito!`);
        this.router.navigate(['/TablaDeDatos']);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message.toString() || 'Ocurrió un error al crear la persona.';
        console.error(err);
        alert(this.errorMessage);
      }
    });
  }
}