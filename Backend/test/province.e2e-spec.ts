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

describe('ProvincesController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let personRepository: Repository<Person>;
  let cityRepository: Repository<City>;
  let provinceRepository: Repository<Province>;
  let countryRepository: Repository<Country>;
  let adminToken: string;
  let userToken: string;
  let seededCountry: Country;

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

    seededCountry = await countryRepository.save({ name: `Argentina${uniqueId}`, code: `AR${timestamp % 100}`.slice(0, 10) });
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  describe('POST /provinces', () => {
    it('debería fallar con 401 Unauthorized si no hay token', () => {
      return request(app.getHttpServer()).post('/provinces').send({}).expect(HttpStatus.UNAUTHORIZED);
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', () => {
      return request(app.getHttpServer())
        .post('/provinces')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(HttpStatus.FORBIDDEN);
    });

    it('debería crear una provincia si el usuario es admin y los datos son válidos', () => {
      const createProvinceDto = {
        name: 'Santa Fe',
        countryId: seededCountry.id,
        latitude: -32.94,
        longitude: -60.64,
      };
      return request(app.getHttpServer())
        .post('/provinces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createProvinceDto)
        .expect(HttpStatus.CREATED)
        .then((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toEqual(createProvinceDto.name);
          expect(res.body.latitude).toEqual(createProvinceDto.latitude);
          expect(res.body.longitude).toEqual(createProvinceDto.longitude);
        });
    });

    it('debería fallar con 409 Conflict si las coordenadas ya existen', async () => {
      const createProvinceDto = {
        name: 'Santa Fe',
        countryId: seededCountry.id,
        latitude: -32.94,
        longitude: -60.64,
      };
      await request(app.getHttpServer())
        .post('/provinces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createProvinceDto)
        .expect(HttpStatus.CREATED);

      const duplicateProvinceDto = {
        name: 'Otra Provincia',
        countryId: seededCountry.id,
        latitude: -32.94,
        longitude: -60.64,
      };
      return request(app.getHttpServer())
        .post('/provinces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateProvinceDto)
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('GET /provinces', () => {
    it('debería devolver una lista de provincias (endpoint público)', async () => {
      // Create a fresh province for this specific test
      const testProvince = await provinceRepository.save({
        name: 'Buenos Aires',
        latitude: -34.60,
        longitude: -58.38,
        country: seededCountry,
        countryId: seededCountry.id
      });

      return request(app.getHttpServer())
        .get('/provinces')
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.length).toBeGreaterThan(0);
          // Find the specific province we created
          const foundProvince = res.body.data.find((province: any) => province.id === testProvince.id);
          expect(foundProvince).toBeDefined();
          expect(foundProvince.name).toEqual('Buenos Aires');
        });
    });
  });

  describe('PUT /provinces/:id', () => {
    it('debería actualizar una provincia si el usuario es admin y los datos son válidos', async () => {
      const province = await provinceRepository.save({
        name: 'Provincia Original',
        latitude: -31.0,
        longitude: -64.0,
        country: seededCountry,
        countryId: seededCountry.id
      });
      const updatePutProvinceDto = {
        name: 'Provincia Actualizada',
        countryId: seededCountry.id,
        latitude: -31.1,
        longitude: -64.1,
      };
      return request(app.getHttpServer())
        .put(`/provinces/${province.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePutProvinceDto)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.name).toEqual(updatePutProvinceDto.name);
          expect(res.body.latitude).toEqual(updatePutProvinceDto.latitude);
          expect(res.body.longitude).toEqual(updatePutProvinceDto.longitude);
        });
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const province = await provinceRepository.save({
        name: 'Provincia Original',
        latitude: -31.0,
        longitude: -64.0,
        country: seededCountry,
        countryId: seededCountry.id
      });
      const updatePutProvinceDto = {
        name: 'Provincia Actualizada',
        countryId: seededCountry.id,
        latitude: -31.1,
        longitude: -64.1,
      };
      return request(app.getHttpServer())
        .put(`/provinces/${province.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatePutProvinceDto)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('PATCH /provinces/:id', () => {
    it('debería actualizar parcialmente una provincia si el usuario es admin', async () => {
      const province = await provinceRepository.save({
        name: 'Provincia Parcial',
        latitude: -31.0,
        longitude: -64.0,
        country: seededCountry,
        countryId: seededCountry.id
      });
      const updatePatchProvinceDto = {
        name: 'Provincia Parcial Actualizada',
      };
      return request(app.getHttpServer())
        .patch(`/provinces/${province.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePatchProvinceDto)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.name).toEqual(updatePatchProvinceDto.name);
          expect(res.body.latitude).toEqual(-31.0); // Should remain unchanged
          expect(res.body.longitude).toEqual(-64.0); // Should remain unchanged
        });
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const province = await provinceRepository.save({
        name: 'Provincia Parcial',
        latitude: -31.0,
        longitude: -64.0,
        country: seededCountry,
        countryId: seededCountry.id
      });
      const updatePatchProvinceDto = {
        name: 'Provincia Parcial Actualizada',
      };
      return request(app.getHttpServer())
        .patch(`/provinces/${province.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatePatchProvinceDto)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('DELETE /provinces/:id', () => {
    it('debería eliminar una provincia si el usuario es admin y no tiene ciudades asociadas', async () => {
      const province = await provinceRepository.save({
        name: 'Provincia a Eliminar',
        latitude: -31.0,
        longitude: -64.0,
        country: seededCountry,
        countryId: seededCountry.id
      });
      return request(app.getHttpServer())
        .delete(`/provinces/${province.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const province = await provinceRepository.save({
        name: 'Provincia a Eliminar',
        latitude: -31.0,
        longitude: -64.0,
        country: seededCountry,
        countryId: seededCountry.id
      });
      return request(app.getHttpServer())
        .delete(`/provinces/${province.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('debería fallar con 409 Conflict si la provincia tiene ciudades asociadas', async () => {
      const province = await provinceRepository.save({
        name: 'Provincia con Ciudades',
        latitude: -31.0,
        longitude: -64.0,
        country: seededCountry,
        countryId: seededCountry.id
      });

      // Create a city for this province
      await cityRepository.save({
        name: 'Ciudad Test',
        latitude: -31.42,
        longitude: -64.18,
        province,
        provinceId: province.id
      });

      return request(app.getHttpServer())
        .delete(`/provinces/${province.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('GET /provinces/:id', () => {
    it('debería devolver una provincia específica si existe', async () => {
      const province = await provinceRepository.save({
        name: 'Provincia Específica',
        latitude: -31.0,
        longitude: -64.0,
        country: seededCountry,
        countryId: seededCountry.id
      });
      return request(app.getHttpServer())
        .get(`/provinces/${province.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.name).toEqual(province.name);
          expect(res.body.latitude).toEqual(province.latitude);
          expect(res.body.longitude).toEqual(province.longitude);
          expect(res.body.id).toEqual(province.id);
        });
    });

    it('debería fallar con 404 Not Found si la provincia no existe', async () => {
      return request(app.getHttpServer())
        .get('/provinces/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /provinces/search', () => {
    it('debería buscar provincias por nombre', async () => {
      await provinceRepository.save({
        name: 'Córdoba',
        latitude: -31.42,
        longitude: -64.18,
        country: seededCountry,
        countryId: seededCountry.id
      });
      await provinceRepository.save({
        name: 'Santa Fe',
        latitude: -32.94,
        longitude: -60.64,
        country: seededCountry,
        countryId: seededCountry.id
      });
      return request(app.getHttpServer())
        .get('/provinces/search?name=Córdoba')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data.length).toBe(1);
          expect(res.body.data[0].name).toEqual('Córdoba');
        });
    });

    it('debería fallar con 400 Bad Request si el nombre está vacío', async () => {
      return request(app.getHttpServer())
        .get('/provinces/search?name=')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('GET /provinces/by-country/:countryId', () => {
    it('debería devolver provincias por país (endpoint público)', async () => {
      const province1 = await provinceRepository.save({
        name: 'Córdoba',
        latitude: -31.42,
        longitude: -64.18,
        country: seededCountry,
        countryId: seededCountry.id
      });
      const province2 = await provinceRepository.save({
        name: 'Santa Fe',
        latitude: -32.94,
        longitude: -60.64,
        country: seededCountry,
        countryId: seededCountry.id
      });
      return request(app.getHttpServer())
        .get(`/provinces/by-country/${seededCountry.id}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data.length).toBe(2);
          expect(res.body.data[0].name).toEqual(province1.name);
        });
    });
  });

  describe('Casos de error y validaciones', () => {
    it('debería fallar con 400 Bad Request al crear provincia con datos inválidos', async () => {
      const invalidCreateProvinceDto = {
        name: '',
        countryId: seededCountry.id,
        latitude: -32.94,
        longitude: -60.64,
      };
      return request(app.getHttpServer())
        .post('/provinces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidCreateProvinceDto)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('debería fallar con 404 Not Found al actualizar provincia inexistente', async () => {
      const updatePutProvinceDto = {
        name: 'Provincia Inexistente',
        countryId: seededCountry.id,
        latitude: -31.1,
        longitude: -64.1,
      };
      return request(app.getHttpServer())
        .put('/provinces/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePutProvinceDto)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('debería fallar con 404 Not Found al eliminar provincia inexistente', async () => {
      return request(app.getHttpServer())
        .delete('/provinces/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
