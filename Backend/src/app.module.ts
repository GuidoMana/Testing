// src/app.module.ts
import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Módulos de la aplicación principal
import { AuthModule } from './auth/auth.module';
import { PersonsModule } from './person/person.module';
import { CitiesModule } from './city/city.module';
import { ProvincesModule } from './province/province.module';
import { CountriesModule } from './country/country.module';

// Módulos para la siembra de datos
import { GeorefModule } from './georef/georef.module';
import { DataSeedingModule } from './database/data-seeding/data-seeding.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST'),
        port: parseInt(configService.get<string>('POSTGRES_PORT', '5433')!, 10),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DB'),
        autoLoadEntities: true,

        synchronize: configService.get<string>('TYPEORM_SYNCHRONIZE') === 'true',

        logging: configService.get<string>('TYPEORM_LOGGING') === 'true',

      }),
    }),
    AuthModule,
    PersonsModule,
    CitiesModule,
    ProvincesModule,
    CountriesModule,
    GeorefModule,
    DataSeedingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule { }
