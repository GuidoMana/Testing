import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueConstraintToProvinceCoords1748627710746 implements MigrationInterface {
    name = 'AddUniqueConstraintToProvinceCoords1748627710746'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "provinces" ADD CONSTRAINT "UQ_335711ea28e92a2c61955794b51" UNIQUE ("latitude", "longitude")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "provinces" DROP CONSTRAINT "UQ_335711ea28e92a2c61955794b51"`);
    }

}
