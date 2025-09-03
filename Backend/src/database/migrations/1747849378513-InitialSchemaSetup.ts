import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchemaSetup1747849378513 implements MigrationInterface {
    name = 'InitialSchemaSetup1747849378513'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "countries" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "code" character varying(10), CONSTRAINT "UQ_fa1376321185575cf2226b1491d" UNIQUE ("name"), CONSTRAINT "UQ_b47cbb5311bad9c9ae17b8c1eda" UNIQUE ("code"), CONSTRAINT "PK_b2d7006793e8697ab3ae2deff18" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fa1376321185575cf2226b1491" ON "countries" ("name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_01d3e56c8da46f6288dcdbae52" ON "countries" ("code") WHERE "code" IS NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."persons_role_enum" AS ENUM('admin', 'user', 'moderator')`);
        await queryRunner.query(`CREATE TABLE "persons" ("id" SERIAL NOT NULL, "firstName" character varying(50) NOT NULL, "lastName" character varying(50) NOT NULL, "email" character varying(100) NOT NULL, "password" character varying NOT NULL, "birthDate" date, "role" "public"."persons_role_enum" NOT NULL DEFAULT 'user', "cityId" integer, CONSTRAINT "UQ_928155276ca8852f3c440cc2b2c" UNIQUE ("email"), CONSTRAINT "PK_74278d8812a049233ce41440ac7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_928155276ca8852f3c440cc2b2" ON "persons" ("email") `);
        await queryRunner.query(`CREATE TABLE "cities" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "provinceId" integer NOT NULL, CONSTRAINT "UQ_574c714490389376a38d88ce937" UNIQUE ("latitude", "longitude"), CONSTRAINT "PK_4762ffb6e5d198cfec5606bc11e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "provinces" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "countryId" integer NOT NULL, CONSTRAINT "PK_2e4260eedbcad036ec53222e0c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "persons" ADD CONSTRAINT "FK_6579eb8e1cd7b7086d8d5edb4b0" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cities" ADD CONSTRAINT "FK_a7c1a801700048901c8e86d1a9e" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "provinces" ADD CONSTRAINT "FK_0a994c2ff2af686951495418a3b" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "provinces" DROP CONSTRAINT "FK_0a994c2ff2af686951495418a3b"`);
        await queryRunner.query(`ALTER TABLE "cities" DROP CONSTRAINT "FK_a7c1a801700048901c8e86d1a9e"`);
        await queryRunner.query(`ALTER TABLE "persons" DROP CONSTRAINT "FK_6579eb8e1cd7b7086d8d5edb4b0"`);
        await queryRunner.query(`DROP TABLE "provinces"`);
        await queryRunner.query(`DROP TABLE "cities"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_928155276ca8852f3c440cc2b2"`);
        await queryRunner.query(`DROP TABLE "persons"`);
        await queryRunner.query(`DROP TYPE "public"."persons_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_01d3e56c8da46f6288dcdbae52"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fa1376321185575cf2226b1491"`);
        await queryRunner.query(`DROP TABLE "countries"`);
    }

}
