// data-source.ts (o src/data-source.ts)
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const configService = new ConfigService();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: configService.get<string>('POSTGRES_HOST'),
  port: parseInt(configService.get<string>('POSTGRES_PORT', '5433')!, 10),
  username: configService.get<string>('POSTGRES_USER'),
  password: configService.get<string>('POSTGRES_PASSWORD'),
  database: configService.get<string>('POSTGRES_DB'),
  entities: [path.join(__dirname, '**', '*.entity.{ts,js}')], // Busca entidades en 'src/' si data-source.ts está en 'src/'
  migrations: [path.join(__dirname, 'database/migrations/*{.ts,.js}')], // Busca migraciones en 'src/database/migrations/'
  synchronize: false, // Debe ser false para usar migraciones
  logging: configService.get<string>('TYPEORM_LOGGING') === 'true',
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;