// src/auth/interfaces/jwt-payload.interface.ts
import { PersonRole } from "../../entities/person.entity";

export interface JwtPayload {
  sub: number;
  email: string;
  role: PersonRole;
  firstName: string;
  lastName: string;
}