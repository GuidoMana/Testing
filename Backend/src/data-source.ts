// data-source.ts (o src/data-source.ts)
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const configService = new ConfigService();

// Forzar configuración de test si NODE_ENV=test
const isTest = process.env.NODE_ENV === 'test';
const host = isTest ? 'localhost' : configService.get<string>('POSTGRES_HOST');
const port = isTest ? 5433 : parseInt(configService.get<string>('POSTGRES_PORT', '5433')!, 10);
const username = isTest ? 'postgres' : configService.get<string>('POSTGRES_USER');
const password = isTest ? 'postgres' : configService.get<string>('POSTGRES_PASSWORD');
const database = isTest ? 'nestjs_test' : configService.get<string>('POSTGRES_DB');

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: host,
  port: port,
  username: username,
  password: password,
  database: database,
  entities: [path.join(__dirname, '**', '*.entity.{ts,js}')], // Busca entidades en 'src/' si data-source.ts está en 'src/'
  migrations: [path.join(__dirname, 'database/migrations/*{.ts,.js}')], // Busca migraciones en 'src/database/migrations/'
  synchronize: false, // Debe ser false para usar migraciones
  logging: configService.get<string>('TYPEORM_LOGGING') === 'true',
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;