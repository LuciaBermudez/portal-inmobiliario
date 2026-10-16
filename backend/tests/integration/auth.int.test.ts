import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { ConflictError, UnauthorizedError } from '../../src/domain/shared/errors';
import { createPool, type Pool } from '../../src/infrastructure/db/pool';
import { PgRefreshTokenStore } from '../../src/infrastructure/repositories/pg-refresh-token-store';
import { PgUserRepository } from '../../src/infrastructure/repositories/pg-user-repository';
import { createUser } from './support/db';

let pool: Pool;
let store: PgRefreshTokenStore;

beforeAll(() => {
  pool = createPool(inject('databaseUrl'));
  store = new PgRefreshTokenStore(pool, 7);
});
afterAll(() => pool.end());

describe('refresh tokens con rotación y detección de reuso', () => {
  it('rotar entrega un token nuevo e invalida el anterior', async () => {
    const userId = await createUser(pool, 'client', null);
    const t1 = await store.issue(userId);

    const { token: t2, userId: owner } = await store.rotate(t1);

    expect(owner).toBe(userId);
    expect(t2).not.toBe(t1);
    await expect(store.rotate(t2)).resolves.toMatchObject({ userId });
  });

  it('reutilizar un token rotado revoca toda la familia (incluido el token vigente)', async () => {
    const userId = await createUser(pool, 'client', null);
    const t1 = await store.issue(userId);
    const { token: t2 } = await store.rotate(t1);

    await expect(store.rotate(t1)).rejects.toThrow(/reutilización/);
    await expect(store.rotate(t2)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('dos refresh concurrentes con el mismo token: uno gana y el otro dispara la revocación', async () => {
    const userId = await createUser(pool, 'client', null);
    const t1 = await store.issue(userId);

    const results = await Promise.allSettled([store.rotate(t1), store.rotate(t1)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('logout revoca la familia', async () => {
    const userId = await createUser(pool, 'client', null);
    const t1 = await store.issue(userId);
    await store.revokeFamily(t1);
    await expect(store.rotate(t1)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('usuarios', () => {
  it('registros simultáneos con el mismo email: el índice único evita duplicados', async () => {
    const users = new PgUserRepository(pool);
    const input = { email: `race-${Date.now()}@test.local`, name: 'R', passwordHash: 'x', role: 'client' as const, agencyId: null };

    const results = await Promise.allSettled([users.create(input), users.create(input)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
  });
});
