import 'module-alias/register';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { Person, PersonRole } from '../src/entities/person.entity';
import { Country } from '../src/entities/country.entity';
import { Province } from '../src/entities/province.entity';
import { City } from '../src/entities/city.entity';
import cookieParser from 'cookie-parser';

describe('CountriesController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let personRepository: Repository<Person>;
  let cityRepository: Repository<City>;
  let provinceRepository: Repository<Province>;
  let countryRepository: Repository<Country>;
  let adminToken: string;
  let userToken: string;

  const createTestUser = async (role: PersonRole, testId: string) => {
    const password = 'Password123!';
    const timestamp = Date.now() + Math.random();
    const uniqueId = `${testId}${timestamp}${Math.floor(Math.random() * 10000)}`;

    // Create test data structure: Country -> Province -> City for the user
    const country = await countryRepository.save({
      name: `UserCountry${uniqueId}`,
      code: `U${uniqueId.slice(0, 3)}${timestamp % 100}`.slice(0, 10) // Ensure max 10 chars
    });
    const province = await provinceRepository.save({
      name: `UserProvince${uniqueId}`,
      latitude: -34.60 + (timestamp % 100) * 0.001, // Unique latitude
      longitude: -58.38 + (timestamp % 100) * 0.001, // Unique longitude
      country,
      countryId: country.id
    });
    const city = await cityRepository.save({
      name: `UserCity${uniqueId}`,
      latitude: -34.6037 + (timestamp % 100) * 0.0001, // Unique latitude
      longitude: -58.3816 + (timestamp % 100) * 0.0001, // Unique longitude
      province,
      provinceId: province.id
    });

    const email = `${role}user${uniqueId}@test.com`;

    // For ADMIN role, create user directly in database to ensure proper role assignment
    if (role === PersonRole.ADMIN) {
      const hashedPassword = await require('bcrypt').hash(password, 10);
      const adminUser = await personRepository.save({
        firstName: role,
        lastName: 'User',
        email: email,
        password: hashedPassword,
        role: PersonRole.ADMIN,
        city: city,
        cityId: city.id
      });
      return { ...adminUser, password };
    }

    // For USER role, use the registration API
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: email,
        password: password,
        firstName: role,
        lastName: 'User',
        cityName: city.name,
        provinceName: province.name,
      });

    if (registerResponse.status !== 201) {
      console.log('Registration failed with status:', registerResponse.status);
      console.log('Response body:', registerResponse.body);
      console.log('City name:', city.name);
      console.log('Province name:', province.name);
      throw new Error(`Registration failed: ${registerResponse.status} - ${JSON.stringify(registerResponse.body)}`);
    }

    // Get the created user from database
    const user = await personRepository.findOne({ where: { email } });
    if (!user) {
      throw new Error(`User with email ${email} not found after registration`);
    }
    return { ...user, password };
  };

  const loginAndGetToken = async (email: string, password: string) => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return response.body.accessToken;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.use(cookieParser());
    await app.init();

    dataSource = app.get(DataSource);
    personRepository = dataSource.getRepository(Person);
    cityRepository = dataSource.getRepository(City);
    provinceRepository = dataSource.getRepository(Province);
    countryRepository = dataSource.getRepository(Country);
  });

  beforeEach(async () => {
    // Limpieza con orden corregido para evitar problemas de FK
    await personRepository.query(`TRUNCATE TABLE "persons" RESTART IDENTITY CASCADE;`);
    await cityRepository.query(`TRUNCATE TABLE "cities" RESTART IDENTITY CASCADE;`);
    await provinceRepository.query(`TRUNCATE TABLE "provinces" RESTART IDENTITY CASCADE;`);
    await countryRepository.query(`TRUNCATE TABLE "countries" RESTART IDENTITY CASCADE;`);

    // Reset sequences to avoid duplicate key violations
    await personRepository.query(`ALTER SEQUENCE persons_id_seq RESTART WITH 1;`);
    await cityRepository.query(`ALTER SEQUENCE cities_id_seq RESTART WITH 1;`);
    await provinceRepository.query(`ALTER SEQUENCE provinces_id_seq RESTART WITH 1;`);
    await countryRepository.query(`ALTER SEQUENCE countries_id_seq RESTART WITH 1;`);

    // Sembrado y autenticación
    const timestamp = Date.now() + Math.random();
    const uniqueId = `global${timestamp}${Math.floor(Math.random() * 10000)}`;

    // Create admin user directly in database with ADMIN role
    const adminUser = await createTestUser(PersonRole.ADMIN, uniqueId);
    const regularUser = await createTestUser(PersonRole.USER, uniqueId);
    if (!adminUser.email || !regularUser.email) {
      throw new Error('User emails are undefined');
    }
    adminToken = await loginAndGetToken(adminUser.email, adminUser.password);
    userToken = await loginAndGetToken(regularUser.email, regularUser.password);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  describe('POST /countries', () => {
    it('debería fallar con 401 Unauthorized si no hay token', () => {
      return request(app.getHttpServer()).post('/countries').send({}).expect(HttpStatus.UNAUTHORIZED);
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', () => {
      return request(app.getHttpServer())
        .post('/countries')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(HttpStatus.FORBIDDEN);
    });

    it('debería crear un país si el usuario es admin y los datos son válidos', () => {
      const createCountryDto = {
        name: 'Chile',
        code: 'CL',
      };
      return request(app.getHttpServer())
        .post('/countries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createCountryDto)
        .expect(HttpStatus.CREATED)
        .then((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toEqual(createCountryDto.name);
          expect(res.body.code).toEqual(createCountryDto.code);
        });
    });

    it('debería fallar con 409 Conflict si el nombre ya existe', async () => {
      const createCountryDto = {
        name: 'Chile',
        code: 'CL',
      };
      await request(app.getHttpServer())
        .post('/countries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createCountryDto)
        .expect(HttpStatus.CREATED);

      return request(app.getHttpServer())
        .post('/countries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createCountryDto)
        .expect(HttpStatus.CONFLICT);
    });

    it('debería fallar con 409 Conflict si el código ya existe', async () => {
      await request(app.getHttpServer())
        .post('/countries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Chile', code: 'CL' })
        .expect(HttpStatus.CREATED);

      return request(app.getHttpServer())
        .post('/countries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Peru', code: 'CL' })
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('GET /countries', () => {
    it('debería devolver una lista de países (endpoint público)', async () => {
      // Create a fresh country for this specific test
      const testCountry = await countryRepository.save({
        name: 'Uruguay',
        code: 'UY'
      });

      return request(app.getHttpServer())
        .get('/countries')
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.length).toBeGreaterThan(0);
          // Find the specific country we created
          const foundCountry = res.body.data.find((country: any) => country.id === testCountry.id);
          expect(foundCountry).toBeDefined();
          expect(foundCountry.name).toEqual('Uruguay');
          expect(foundCountry.code).toEqual('UY');
        });
    });
  });

  describe('PUT /countries/:id', () => {
    it('debería actualizar un país si el usuario es admin y los datos son válidos', async () => {
      const country = await countryRepository.save({ name: 'País Original', code: 'PO' });
      const updatePutCountryDto = {
        name: 'País Actualizado',
        code: 'PA',
      };
      return request(app.getHttpServer())
        .put(`/countries/${country.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePutCountryDto)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.name).toEqual(updatePutCountryDto.name);
          expect(res.body.code).toEqual(updatePutCountryDto.code);
        });
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const country = await countryRepository.save({ name: 'País Original', code: 'PO' });
      const updatePutCountryDto = {
        name: 'País Actualizado',
        code: 'PA',
      };
      return request(app.getHttpServer())
        .put(`/countries/${country.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatePutCountryDto)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('PATCH /countries/:id', () => {
    it('debería actualizar parcialmente un país si el usuario es admin', async () => {
      const country = await countryRepository.save({ name: 'País Parcial', code: 'PP' });
      const updatePatchCountryDto = {
        name: 'País Parcial Actualizado',
      };
      return request(app.getHttpServer())
        .patch(`/countries/${country.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePatchCountryDto)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.name).toEqual(updatePatchCountryDto.name);
          expect(res.body.code).toEqual('PP'); // Should remain unchanged
        });
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const country = await countryRepository.save({ name: 'País Parcial', code: 'PP' });
      const updatePatchCountryDto = {
        name: 'País Parcial Actualizado',
      };
      return request(app.getHttpServer())
        .patch(`/countries/${country.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatePatchCountryDto)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('DELETE /countries/:id', () => {
    it('debería eliminar un país si el usuario es admin y no tiene provincias asociadas', async () => {
      const country = await countryRepository.save({ name: 'País a Eliminar', code: 'PE' });
      return request(app.getHttpServer())
        .delete(`/countries/${country.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const country = await countryRepository.save({ name: 'País a Eliminar', code: 'PE' });
      return request(app.getHttpServer())
        .delete(`/countries/${country.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('debería fallar con 409 Conflict si el país tiene provincias asociadas', async () => {
      const country = await countryRepository.save({ name: 'País con Provincias', code: 'PCP' });

      // Create a province for this country
      await provinceRepository.save({
        name: 'Provincia Test',
        latitude: -31.42,
        longitude: -64.18,
        country,
        countryId: country.id
      });

      return request(app.getHttpServer())
        .delete(`/countries/${country.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('GET /countries/:id', () => {
    it('debería devolver un país específico si existe', async () => {
      const country = await countryRepository.save({ name: 'País Específico', code: 'PES' });
      return request(app.getHttpServer())
        .get(`/countries/${country.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.name).toEqual(country.name);
          expect(res.body.code).toEqual(country.code);
          expect(res.body.id).toEqual(country.id);
        });
    });

    it('debería fallar con 404 Not Found si el país no existe', async () => {
      return request(app.getHttpServer())
        .get('/countries/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /countries/search', () => {
    it('debería buscar países por nombre', async () => {
      await countryRepository.save({ name: 'Argentina', code: 'AR' });
      await countryRepository.save({ name: 'Brasil', code: 'BR' });
      return request(app.getHttpServer())
        .get('/countries/search?name=Argentina')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data.length).toBe(1);
          expect(res.body.data[0].name).toEqual('Argentina');
        });
    });

    it('debería fallar con 400 Bad Request si el nombre está vacío', async () => {
      return request(app.getHttpServer())
        .get('/countries/search?name=')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Casos de error y validaciones', () => {
    it('debería fallar con 400 Bad Request al crear país con datos inválidos', async () => {
      const invalidCreateCountryDto = {
        name: '',
        code: 'CL',
      };
      return request(app.getHttpServer())
        .post('/countries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidCreateCountryDto)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('debería fallar con 404 Not Found al actualizar país inexistente', async () => {
      const updatePutCountryDto = {
        name: 'País Inexistente',
        code: 'PI',
      };
      return request(app.getHttpServer())
        .put('/countries/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePutCountryDto)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('debería fallar con 404 Not Found al eliminar país inexistente', async () => {
      return request(app.getHttpServer())
        .delete('/countries/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
