import type { Role } from '@portal/shared';
import type { NewUser, User, UserRepository } from '../../domain/auth/user';
import { ConflictError } from '../../domain/shared/errors';
import { isUniqueViolation, type Pool } from '../db/pool';

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  agency_id: string | null;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  name: r.name,
  passwordHash: r.password_hash,
  role: r.role,
  agencyId: r.agency_id,
});

const COLUMNS = 'id, email, name, password_hash, role, agency_id';

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async create(user: NewUser): Promise<User> {
    try {
      const { rows } = await this.pool.query<UserRow>(
        `INSERT INTO users (email, name, password_hash, role, agency_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
        [user.email, user.name, user.passwordHash, user.role, user.agencyId],
      );
      return toUser(rows[0]!);
    } catch (error) {
      // Dos registros simultáneos con el mismo email: el índice único decide, sin carreras.
      if (isUniqueViolation(error)) throw new ConflictError('El email ya está registrado');
      throw error;
    }
  }
}
