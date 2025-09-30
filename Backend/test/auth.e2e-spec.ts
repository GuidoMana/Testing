// test/auth.e2e-spec.ts

import 'module-alias/register';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { Response } from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { Country } from '../src/entities/country.entity';
import { Province } from '../src/entities/province.entity';
import { City } from '../src/entities/city.entity';
import { Person } from '../src/entities/person.entity';
import cookieParser from 'cookie-parser';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let personRepository: Repository<Person>;
  let cityRepository: Repository<City>;
  let provinceRepository: Repository<Province>;
  let countryRepository: Repository<Country>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    app.use(cookieParser());
    await app.init();

    dataSource = app.get(DataSource);
    personRepository = dataSource.getRepository(Person);
    cityRepository = dataSource.getRepository(City);
    provinceRepository = dataSource.getRepository(Province);
    countryRepository = dataSource.getRepository(Country);
  });

  beforeEach(async () => {
    // Clean up in correct order to avoid foreign key constraint violations
    await personRepository.query(`TRUNCATE TABLE "persons" RESTART IDENTITY CASCADE;`);
    await cityRepository.query(`TRUNCATE TABLE "cities" RESTART IDENTITY CASCADE;`);
    await provinceRepository.query(`TRUNCATE TABLE "provinces" RESTART IDENTITY CASCADE;`);
    await countryRepository.query(`TRUNCATE TABLE "countries" RESTART IDENTITY CASCADE;`);

    // Reset sequences to avoid duplicate key violations
    await personRepository.query(`ALTER SEQUENCE persons_id_seq RESTART WITH 1;`);
    await cityRepository.query(`ALTER SEQUENCE cities_id_seq RESTART WITH 1;`);
    await provinceRepository.query(`ALTER SEQUENCE provinces_id_seq RESTART WITH 1;`);
    await countryRepository.query(`ALTER SEQUENCE countries_id_seq RESTART WITH 1;`);
  });

  // Helper function to create unique test data
  const createTestData = async (testId: string) => {
    const timestamp = Date.now() + Math.random();
    const randomSuffix = Math.random().toString(36).substr(2, 9);
    const uniqueId = `${testId}_${timestamp}_${randomSuffix}`;

    const country = await countryRepository.save({
      name: `TestCountry${uniqueId}`,
      code: `T${uniqueId.slice(0, 3)}${timestamp % 100}`.slice(0, 10) // Ensure max 10 chars
    });
    const province = await provinceRepository.save({
      name: `TestProvince${uniqueId}`,
      latitude: -34.60 + (timestamp % 100) * 0.001, // Unique latitude
      longitude: -58.38 + (timestamp % 100) * 0.001, // Unique longitude
      country,
      countryId: country.id
    });
    const city = await cityRepository.save({
      name: `TestCity${uniqueId}`,
      latitude: -34.6037 + (timestamp % 100) * 0.0001, // Unique latitude
      longitude: -58.3816 + (timestamp % 100) * 0.0001, // Unique longitude
      province,
      provinceId: province.id
    });
    return { country, province, city };
  };

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('debería registrar un usuario y devolver 201 Created', async () => {
      const { city } = await createTestData('register1');
      const validDto = {
        email: `test-${Date.now()}@example.com`,
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        cityName: city.name,
        provinceName: city.province.name,
      };
      return request(app.getHttpServer()).post('/auth/register').send(validDto).expect(201);
    });

    it('debería fallar con 400 Bad Request si el email es inválido', async () => {
      const invalidDto = { email: 'not-an-email', password: 'Password123!', firstName: 'Test', lastName: 'User', cityName: 'Buenos Aires', provinceName: 'CABA' };
      return request(app.getHttpServer()).post('/auth/register').send(invalidDto).expect(400);
    });

    it('debería fallar con 409 Conflict si el email ya existe', async () => {
      const { city } = await createTestData('conflict1');
      const dto = { email: `conflict-${Date.now()}@example.com`, password: 'Password123!', firstName: 'Test', lastName: 'User', cityName: city.name, provinceName: city.province.name };
      await request(app.getHttpServer()).post('/auth/register').send(dto).expect(201);
      return request(app.getHttpServer()).post('/auth/register').send(dto).expect(409);
    });
  });

  describe('POST /auth/login', () => {
    let userEmail: string;
    let userPassword: string;
    let testCity: City;

    beforeEach(async () => {
      userEmail = `login-test-${Date.now()}@example.com`;
      userPassword = 'Password123!';

      // Create test data structure: Country -> Province -> City
      const { city } = await createTestData('login1');
      testCity = city;

      // Register user through the API to ensure proper password hashing
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: userEmail,
          password: userPassword,
          firstName: 'Login',
          lastName: 'TestUser',
          cityName: testCity.name,
          provinceName: testCity.province.name,
        })
        .expect(201);
    });

    it('debería iniciar sesión y devolver un token de acceso', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: userPassword })
        .expect(200)
        .expect((res: Response) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.headers['set-cookie']).toBeDefined();
        });
    });

    it('debería fallar con 401 Unauthorized si las credenciales son incorrectas', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userEmail, password: 'wrongpassword' })
        .expect(401);
    });
  });

  describe('Rutas Protegidas de Auth', () => {
    let userEmail: string;
    let userPassword: string;
    let accessToken: string;
    let testCity: City;

    beforeEach(async () => {
      userEmail = `protected-route-${Date.now()}@example.com`;
      userPassword = 'Password123!';

      // Create test data structure: Country -> Province -> City
      const { city } = await createTestData('protected1');
      testCity = city;

      // Register user through the API to ensure proper password hashing
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: userEmail,
          password: userPassword,
          firstName: 'Protected',
          lastName: 'TestUser',
          cityName: testCity.name,
          provinceName: testCity.province.name,
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({ email: userEmail, password: userPassword });
      accessToken = loginResponse.body.accessToken;
    });

    it('debería fallar con 401 Unauthorized si no se provee un token', () => {
      return request(app.getHttpServer()).get('/auth/profile').expect(401);
    });

    describe('GET /auth/profile', () => {
      it('debería devolver los datos del usuario si el token es válido', () => {
        return request(app.getHttpServer())
          .get('/auth/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: Response) => {
            expect(res.body.email).toEqual(userEmail);
          });
      });
    });

    describe('GET /auth/status', () => {
      it('debería devolver un estado de autenticado si el token es válido', () => {
        return request(app.getHttpServer())
          .get('/auth/status')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: Response) => {
            expect(res.body.isAuthenticated).toBe(true);
            expect(res.body.user.email).toEqual(userEmail);
          });
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('debería limpiar la cookie jwt y cerrar la sesión', async () => {
      const agent = request.agent(app.getHttpServer());
      const userEmail = `logout-test-${Date.now()}@example.com`;
      const userPassword = 'Password123!';

      // Create test data structure: Country -> Province -> City
      const { city } = await createTestData('logout1');
      const testCity = city;

      // Register user through the API to ensure proper password hashing
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: userEmail,
          password: userPassword,
          firstName: 'Logout',
          lastName: 'TestUser',
          cityName: testCity.name,
          provinceName: testCity.province.name,
        })
        .expect(201);

      await agent.post('/auth/login').send({ email: userEmail, password: userPassword }).expect(200);

      return agent
        .post('/auth/logout')
        .expect(200)
        .expect((res: Response) => {
          expect(res.body.message).toEqual('Sesión cerrada exitosamente.');
          const cookieHeader = res.headers['set-cookie'][0];
          expect(cookieHeader).toContain('jwt=;');
          expect(cookieHeader).toContain('Expires=');
        });
    });
  });
});
