import type { Role } from '@portal/shared';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  agencyId: string | null;
}

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  agencyId: string | null;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** Lanza ConflictError si el email ya existe (garantizado por índice único, sin carreras). */
  create(user: NewUser): Promise<User>;
}
