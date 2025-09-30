//test\city.e2e-spec.ts

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

describe('CitiesController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let personRepository: Repository<Person>;
  let cityRepository: Repository<City>;
  let provinceRepository: Repository<Province>;
  let countryRepository: Repository<Country>;
  let adminToken: string;
  let userToken: string;
  let seededProvince: Province;

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

    const country = await countryRepository.save({ name: `Argentina${uniqueId}`, code: `AR${timestamp % 100}`.slice(0, 10) });
    seededProvince = await provinceRepository.save({ name: `Córdoba${uniqueId}`, latitude: -31.42 + (timestamp % 100) * 0.001, longitude: -64.18 + (timestamp % 100) * 0.001, country, countryId: country.id });
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  describe('POST /cities', () => {
    it('debería fallar con 401 Unauthorized si no hay token', () => {
      return request(app.getHttpServer()).post('/cities').send({}).expect(HttpStatus.UNAUTHORIZED);
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', () => {
      return request(app.getHttpServer())
        .post('/cities')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(HttpStatus.FORBIDDEN);
    });

    it('debería crear una ciudad si el usuario es admin y los datos son válidos', () => {
      const createCityDto = {
        name: 'Villa María',
        provinceId: seededProvince.id,
        latitude: -32.40,
        longitude: -63.24,
      };
      return request(app.getHttpServer())
        .post('/cities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createCityDto)
        .expect(HttpStatus.CREATED)
        .then((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toEqual(createCityDto.name);
        });
    });
  });

  describe('GET /cities', () => {
    it('debería devolver una lista de ciudades (endpoint público)', async () => {
      // Create a fresh city for this specific test
      const testCity = await cityRepository.save({
        name: 'Córdoba Capital',
        province: seededProvince,
        provinceId: seededProvince.id,
        latitude: -31.42,
        longitude: -64.18
      });

      return request(app.getHttpServer())
        .get('/cities')
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.length).toBeGreaterThan(0);
          // Find the specific city we created
          const foundCity = res.body.data.find((city: any) => city.id === testCity.id);
          expect(foundCity).toBeDefined();
          expect(foundCity.name).toEqual('Córdoba Capital');
          expect(foundCity.id).toEqual(testCity.id);
        });
    });
  });

  describe('PUT /cities/:id', () => {
    it('debería actualizar una ciudad si el usuario es admin y los datos son válidos', async () => {
      const city = await cityRepository.save({ name: 'Ciudad Original', province: seededProvince, provinceId: seededProvince.id, latitude: -31.0, longitude: -64.0 });
      const updatePutCityDto = {
        name: 'Ciudad Actualizada',
        provinceId: seededProvince.id,
        latitude: -31.1,
        longitude: -64.1,
      };
      return request(app.getHttpServer())
        .put(`/cities/${city.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePutCityDto)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.name).toEqual(updatePutCityDto.name);
          expect(res.body.latitude).toEqual(updatePutCityDto.latitude);
        });
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const city = await cityRepository.save({ name: 'Ciudad Original', province: seededProvince, provinceId: seededProvince.id, latitude: -31.0, longitude: -64.0 });
      const updatePutCityDto = {
        name: 'Ciudad Actualizada',
        provinceId: seededProvince.id,
        latitude: -31.1,
        longitude: -64.1,
      };
      return request(app.getHttpServer())
        .put(`/cities/${city.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatePutCityDto)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('PATCH /cities/:id', () => {
    it('debería actualizar parcialmente una ciudad si el usuario es admin', async () => {
      const city = await cityRepository.save({ name: 'Ciudad Parcial', province: seededProvince, provinceId: seededProvince.id, latitude: -31.0, longitude: -64.0 });
      const updatePatchCityDto = {
        name: 'Ciudad Parcial Actualizada',
      };
      return request(app.getHttpServer())
        .patch(`/cities/${city.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePatchCityDto)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.name).toEqual(updatePatchCityDto.name);
        });
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const city = await cityRepository.save({ name: 'Ciudad Parcial', province: seededProvince, provinceId: seededProvince.id, latitude: -31.0, longitude: -64.0 });
      const updatePatchCityDto = {
        name: 'Ciudad Parcial Actualizada',
      };
      return request(app.getHttpServer())
        .patch(`/cities/${city.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatePatchCityDto)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('DELETE /cities/:id', () => {
    it('debería eliminar una ciudad si el usuario es admin y no tiene personas asociadas', async () => {
      const city = await cityRepository.save({ name: 'Ciudad a Eliminar', province: seededProvince, provinceId: seededProvince.id, latitude: -31.0, longitude: -64.0 });
      return request(app.getHttpServer())
        .delete(`/cities/${city.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const city = await cityRepository.save({ name: 'Ciudad a Eliminar', province: seededProvince, provinceId: seededProvince.id, latitude: -31.0, longitude: -64.0 });
      return request(app.getHttpServer())
        .delete(`/cities/${city.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('debería fallar con 409 Conflict si la ciudad tiene personas asociadas', async () => {
      const city = await cityRepository.save({ name: 'Ciudad con Personas', province: seededProvince, provinceId: seededProvince.id, latitude: -31.0, longitude: -64.0 });

      // Reload city with province relation to ensure it's loaded
      const reloadedCity = await cityRepository.findOne({
        where: { id: city.id },
        relations: ['province']
      });
      if (!reloadedCity) {
        throw new Error(`Failed to reload city with ID ${city.id}`);
      }

      const timestamp = Date.now();
      const testPersonEmail = `test-person-${timestamp}@example.com`;

      // Register test person through API to ensure proper password hashing
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testPersonEmail,
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
          cityName: reloadedCity.name,
          provinceName: reloadedCity.province.name,
        })
        .expect(201);

      return request(app.getHttpServer())
        .delete(`/cities/${city.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('GET /cities/:id', () => {
    it('debería devolver una ciudad específica si existe', async () => {
      const city = await cityRepository.save({ name: 'Ciudad Específica', province: seededProvince, provinceId: seededProvince.id, latitude: -31.0, longitude: -64.0 });
      return request(app.getHttpServer())
        .get(`/cities/${city.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.name).toEqual(city.name);
          expect(res.body.id).toEqual(city.id);
        });
    });

    it('debería fallar con 404 Not Found si la ciudad no existe', async () => {
      return request(app.getHttpServer())
        .get('/cities/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /cities/search', () => {
    it('debería buscar ciudades por nombre', async () => {
      await cityRepository.save({ name: 'Córdoba Capital', province: seededProvince, provinceId: seededProvince.id, latitude: -31.42, longitude: -64.18 });
      await cityRepository.save({ name: 'Villa Córdoba', province: seededProvince, provinceId: seededProvince.id, latitude: -31.5, longitude: -64.2 });
      return request(app.getHttpServer())
        .get('/cities/search?name=Córdoba')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data.length).toBe(2);
          expect(res.body.data[0].name).toContain('Córdoba');
        });
    });

    it('debería fallar con 400 Bad Request si el nombre está vacío', async () => {
      return request(app.getHttpServer())
        .get('/cities/search?name=')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('GET /cities/by-province/:provinceId', () => {
    it('debería devolver ciudades por provincia (endpoint público)', async () => {
      const city1 = await cityRepository.save({ name: 'Córdoba Capital', province: seededProvince, provinceId: seededProvince.id, latitude: -31.42, longitude: -64.18 });
      const city2 = await cityRepository.save({ name: 'Villa María', province: seededProvince, provinceId: seededProvince.id, latitude: -32.4, longitude: -63.24 });
      return request(app.getHttpServer())
        .get(`/cities/by-province/${seededProvince.id}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data.length).toBe(2);
          expect(res.body.data[0].name).toEqual(city1.name);
        });
    });
  });

  describe('Casos de error y validaciones', () => {
    it('debería fallar con 400 Bad Request al crear ciudad con datos inválidos', async () => {
      const invalidCreateCityDto = {
        name: '',
        provinceId: seededProvince.id,
        latitude: 'invalid',
        longitude: -64.18,
      };
      return request(app.getHttpServer())
        .post('/cities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidCreateCityDto)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('debería fallar con 404 Not Found al actualizar ciudad inexistente', async () => {
      const updatePutCityDto = {
        name: 'Ciudad Inexistente',
        provinceId: seededProvince.id,
        latitude: -31.1,
        longitude: -64.1,
      };
      return request(app.getHttpServer())
        .put('/cities/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePutCityDto)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('debería fallar con 404 Not Found al eliminar ciudad inexistente', async () => {
      return request(app.getHttpServer())
        .delete('/cities/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
