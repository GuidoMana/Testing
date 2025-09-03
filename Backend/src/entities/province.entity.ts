// src/province/entities/province.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Unique } from 'typeorm';
import { Country } from '../entities/country.entity'; 
import { City } from '../entities/city.entity';   

@Entity('provinces')
@Unique(['latitude', 'longitude'])
export class Province {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'double precision', nullable: false })
  latitude!: number;

  @Column({ type: 'double precision', nullable: false })
  longitude!: number;

  @ManyToOne(() => Country, (country) => country.provinces, { eager: false, nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'countryId' })
  country!: Country;

  @Column({ type: 'int', name: 'countryId', nullable: false })
  countryId!: number;

  @OneToMany(() => City, (city) => city.province)
  cities!: City[];

}
