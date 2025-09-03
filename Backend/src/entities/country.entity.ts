// src/country/entities/country.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index } from 'typeorm';
import { Province } from '../entities/province.entity';

@Entity('countries')
export class Country {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, nullable: false, unique: true })
  name!: string;

  @Index({ unique: true, where: '"code" IS NOT NULL' })
  @Column({ type: 'varchar', length: 10, nullable: true, unique: true })
  code!: string | null;

  @OneToMany(() => Province, (province) => province.country)
  provinces!: Province[];
}

