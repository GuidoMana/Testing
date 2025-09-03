// src/scripts/create-initial-admin.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno desde .env
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import { Person, PersonRole } from '../entities/person.entity';
import { City } from '../entities/city.entity';


import dataSource from '../data-source';

async function createInitialAdmin() {
  console.log('Iniciando script para crear usuario administrador inicial...');

  try {
    await dataSource.initialize();
    console.log('Conexión a la base de datos establecida.');

    const personRepository = dataSource.getRepository(Person);
    const cityRepository = dataSource.getRepository(City);

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

    // Verificar si ya existe un administrador
    const existingAdmin = await personRepository.findOne({
      where: { email: adminEmail },
      select: ['id'] // Solo carga el ID, no la contraseña
    });

    if (existingAdmin) {
      console.log(`El usuario administrador con email '${adminEmail}' ya existe (ID: ${existingAdmin.id}).`);
      await dataSource.destroy();
      return;
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Opcional: Asignar una ciudad si ya existe alguna.
    // Si no tienes ciudades, puedes crear el admin sin cityId inicialmente.
    let cityId: number | null = null;
    let city: City | null = null;
    try {
      const [firstCity] = await cityRepository.find({ take: 1 });

      if (firstCity) {
        cityId = firstCity.id;
        city = firstCity;
        console.log(`Asignando la primera ciudad encontrada (ID: ${cityId}) al administrador.`);
      } else {
        console.log('No se encontraron ciudades en la base de datos. El administrador se creará sin una ciudad asignada.');
      }
    } catch (cityError) {
      console.warn('Error al buscar ciudad, el administrador se creará sin una ciudad:', cityError instanceof Error ? cityError.message : String(cityError));
    }

    const newAdmin = personRepository.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: adminEmail,
      password: hashedPassword, // Ya hasheada aquí
      role: PersonRole.ADMIN, // Asignar el rol de ADMINISTRADOR
      city: city, // Asignar el objeto city si se encontró
      cityId: cityId, // Asignar el ID de la ciudad o null
      birthDate: '1990-01-01', // Opcional
    });

    await personRepository.save(newAdmin);
    console.log(`Usuario administrador '${adminEmail}' creado exitosamente con ID: ${newAdmin.id}`);

  } catch (error) {
    console.error('Error al crear el usuario administrador inicial:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('Conexión a la base de datos cerrada.');
    }
  }
}

createInitialAdmin();