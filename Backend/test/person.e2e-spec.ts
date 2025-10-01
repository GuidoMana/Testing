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

describe('PersonController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let personRepository: Repository<Person>;
  let cityRepository: Repository<City>;
  let provinceRepository: Repository<Province>;
  let countryRepository: Repository<Country>;
  let adminToken: string;
  let moderatorToken: string;
  let userToken: string;
  let seededCity: City;

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

    // For ADMIN and MODERATOR roles, create user directly in database to ensure proper role assignment
    if (role === PersonRole.ADMIN || role === PersonRole.MODERATOR) {
      const hashedPassword = await require('bcrypt').hash(password, 10);
      const user = await personRepository.save({
        firstName: role,
        lastName: 'User',
        email: email,
        password: hashedPassword,
        role: role,
        city: city,
        cityId: city.id
      });
      return { ...user, password };
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

    // Create admin, moderator, and regular users
    const adminUser = await createTestUser(PersonRole.ADMIN, uniqueId);
    const moderatorUser = await createTestUser(PersonRole.MODERATOR, uniqueId);
    const regularUser = await createTestUser(PersonRole.USER, uniqueId);

    if (!adminUser.email || !moderatorUser.email || !regularUser.email) {
      throw new Error('User emails are undefined');
    }

    adminToken = await loginAndGetToken(adminUser.email, adminUser.password);
    moderatorToken = await loginAndGetToken(moderatorUser.email, moderatorUser.password);
    userToken = await loginAndGetToken(regularUser.email, regularUser.password);

    const country = await countryRepository.save({ name: `Argentina${uniqueId}`, code: `AR${timestamp % 100}`.slice(0, 10) });
    const province = await provinceRepository.save({ name: `Córdoba${uniqueId}`, latitude: -31.42 + (timestamp % 100) * 0.001, longitude: -64.18 + (timestamp % 100) * 0.001, country, countryId: country.id });
    seededCity = await cityRepository.save({ name: `Córdoba Capital${uniqueId}`, latitude: -31.42 + (timestamp % 100) * 0.0001, longitude: -64.18 + (timestamp % 100) * 0.0001, province, provinceId: province.id });
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  describe('POST /persons', () => {
    it('debería fallar con 401 Unauthorized si no hay token', () => {
      return request(app.getHttpServer()).post('/persons').send({}).expect(HttpStatus.UNAUTHORIZED);
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', () => {
      return request(app.getHttpServer())
        .post('/persons')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(HttpStatus.FORBIDDEN);
    });

    it('debería crear una persona si el usuario es admin y los datos son válidos', () => {
      const createPersonDto = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@example.com',
        password: 'Password123!',
        cityId: seededCity.id,
        role: PersonRole.USER,
      };
      return request(app.getHttpServer())
        .post('/persons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createPersonDto)
        .expect(HttpStatus.CREATED)
        .then((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.firstName).toEqual(createPersonDto.firstName);
          expect(res.body.lastName).toEqual(createPersonDto.lastName);
          expect(res.body.email).toEqual(createPersonDto.email);
          expect(res.body.role).toEqual(createPersonDto.role);
        });
    });

    it('debería fallar con 409 Conflict si el email ya existe', async () => {
      const createPersonDto = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@example.com',
        password: 'Password123!',
        cityId: seededCity.id,
        role: PersonRole.USER,
      };
      await request(app.getHttpServer())
        .post('/persons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createPersonDto)
        .expect(HttpStatus.CREATED);

      const duplicatePersonDto = {
        firstName: 'María',
        lastName: 'García',
        email: 'juan.perez@example.com', // Same email
        password: 'Password123!',
        cityId: seededCity.id,
        role: PersonRole.USER,
      };
      return request(app.getHttpServer())
        .post('/persons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicatePersonDto)
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('GET /persons', () => {
    it('debería fallar con 401 Unauthorized si no hay token', () => {
      return request(app.getHttpServer()).get('/persons').expect(HttpStatus.UNAUTHORIZED);
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin o moderator', () => {
      return request(app.getHttpServer())
        .get('/persons')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('debería devolver una lista de personas si el usuario es admin', async () => {
      // Create a fresh person for this specific test
      const testPerson = await personRepository.save({
        firstName: 'Test',
        lastName: 'Person',
        email: 'test.person@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });

      return request(app.getHttpServer())
        .get('/persons')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.length).toBeGreaterThan(0);
          // Find the specific person we created
          const foundPerson = res.body.data.find((person: any) => person.id === testPerson.id);
          expect(foundPerson).toBeDefined();
          expect(foundPerson.firstName).toEqual('Test');
          expect(foundPerson.lastName).toEqual('Person');
        });
    });

    it('debería devolver una lista de personas si el usuario es moderator', () => {
      return request(app.getHttpServer())
        .get('/persons')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });
  });

  describe('PUT /persons/:id', () => {
    it('debería actualizar una persona si el usuario es admin y los datos son válidos', async () => {
      const person = await personRepository.save({
        firstName: 'Persona',
        lastName: 'Original',
        email: 'persona.original@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });
      const updatePutPersonDto = {
        firstName: 'Persona',
        lastName: 'Actualizada',
        email: 'persona.actualizada@example.com',
        password: 'NewPassword123!',
        cityId: seededCity.id,
        role: PersonRole.USER,
      };
      return request(app.getHttpServer())
        .put(`/persons/${person.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePutPersonDto)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.firstName).toEqual(updatePutPersonDto.firstName);
          expect(res.body.lastName).toEqual(updatePutPersonDto.lastName);
          expect(res.body.email).toEqual(updatePutPersonDto.email);
        });
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const person = await personRepository.save({
        firstName: 'Persona',
        lastName: 'Original',
        email: 'persona.original2@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });
      const updatePutPersonDto = {
        firstName: 'Persona',
        lastName: 'Actualizada',
        email: 'persona.actualizada2@example.com',
        password: 'NewPassword123!',
        cityId: seededCity.id,
        role: PersonRole.USER,
      };
      return request(app.getHttpServer())
        .put(`/persons/${person.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatePutPersonDto)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('PATCH /persons/:id', () => {
    it('debería actualizar parcialmente una persona si el usuario es admin', async () => {
      const person = await personRepository.save({
        firstName: 'Persona',
        lastName: 'Parcial',
        email: 'persona.parcial@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });
      const updatePatchPersonDto = {
        lastName: 'Parcial Actualizada',
      };
      return request(app.getHttpServer())
        .patch(`/persons/${person.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePatchPersonDto)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.lastName).toEqual(updatePatchPersonDto.lastName);
          expect(res.body.firstName).toEqual('Persona'); // Should remain unchanged
        });
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const person = await personRepository.save({
        firstName: 'Persona',
        lastName: 'Parcial',
        email: 'persona.parcial2@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });
      const updatePatchPersonDto = {
        lastName: 'Parcial Actualizada',
      };
      return request(app.getHttpServer())
        .patch(`/persons/${person.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatePatchPersonDto)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('DELETE /persons/:id', () => {
    it('debería eliminar una persona si el usuario es admin', async () => {
      const person = await personRepository.save({
        firstName: 'Persona',
        lastName: 'Eliminar',
        email: 'persona.eliminar@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });
      return request(app.getHttpServer())
        .delete(`/persons/${person.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.message).toContain('eliminada');
        });
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin', async () => {
      const person = await personRepository.save({
        firstName: 'Persona',
        lastName: 'Eliminar',
        email: 'persona.eliminar2@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });
      return request(app.getHttpServer())
        .delete(`/persons/${person.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('GET /persons/:id', () => {
    it('debería fallar con 401 Unauthorized si no hay token', () => {
      return request(app.getHttpServer()).get('/persons/1').expect(HttpStatus.UNAUTHORIZED);
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin o moderator', () => {
      return request(app.getHttpServer())
        .get('/persons/1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('debería devolver una persona específica si existe y el usuario es admin', async () => {
      const person = await personRepository.save({
        firstName: 'Persona',
        lastName: 'Específica',
        email: 'persona.especifica@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });
      return request(app.getHttpServer())
        .get(`/persons/${person.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.firstName).toEqual(person.firstName);
          expect(res.body.lastName).toEqual(person.lastName);
          expect(res.body.email).toEqual(person.email);
          expect(res.body.id).toEqual(person.id);
        });
    });

    it('debería devolver una persona específica si existe y el usuario es moderator', async () => {
      const person = await personRepository.save({
        firstName: 'Persona',
        lastName: 'Específica',
        email: 'persona.especifica2@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });
      return request(app.getHttpServer())
        .get(`/persons/${person.id}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.firstName).toEqual(person.firstName);
          expect(res.body.lastName).toEqual(person.lastName);
          expect(res.body.email).toEqual(person.email);
          expect(res.body.id).toEqual(person.id);
        });
    });

    it('debería fallar con 404 Not Found si la persona no existe', async () => {
      return request(app.getHttpServer())
        .get('/persons/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /persons/search', () => {
    it('debería fallar con 401 Unauthorized si no hay token', () => {
      return request(app.getHttpServer()).get('/persons/search?name=Test').expect(HttpStatus.UNAUTHORIZED);
    });

    it('debería fallar con 403 Forbidden si el usuario no es admin o moderator', () => {
      return request(app.getHttpServer())
        .get('/persons/search?name=Test')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('debería buscar personas por nombre si el usuario es admin', async () => {
      await personRepository.save({
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });
      await personRepository.save({
        firstName: 'María',
        lastName: 'García',
        email: 'maria.garcia@example.com',
        password: await require('bcrypt').hash('Password123!', 10),
        role: PersonRole.USER,
        city: seededCity,
        cityId: seededCity.id
      });
      return request(app.getHttpServer())
        .get('/persons/search?name=Juan')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK)
        .then((res) => {
          expect(res.body.data.length).toBe(1);
          expect(res.body.data[0].firstName).toEqual('Juan');
          expect(res.body.data[0].lastName).toEqual('Pérez');
        });
    });

    it('debería fallar con 400 Bad Request si el nombre está vacío', async () => {
      return request(app.getHttpServer())
        .get('/persons/search?name=')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Casos de error y validaciones', () => {
    it('debería fallar con 400 Bad Request al crear persona con datos inválidos', async () => {
      const invalidCreatePersonDto = {
        firstName: '',
        lastName: 'Pérez',
        email: 'juan.perez@example.com',
        password: 'Password123!',
        cityId: seededCity.id,
        role: PersonRole.USER,
      };
      return request(app.getHttpServer())
        .post('/persons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidCreatePersonDto)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('debería fallar con 404 Not Found al actualizar persona inexistente', async () => {
      const updatePutPersonDto = {
        firstName: 'Persona',
        lastName: 'Inexistente',
        email: 'persona.inexistente@example.com',
        password: 'Password123!',
        cityId: seededCity.id,
        role: PersonRole.USER,
      };
      return request(app.getHttpServer())
        .put('/persons/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePutPersonDto)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('debería fallar con 404 Not Found al eliminar persona inexistente', async () => {
      return request(app.getHttpServer())
        .delete('/persons/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
