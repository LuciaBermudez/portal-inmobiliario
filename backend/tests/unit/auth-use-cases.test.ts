import { describe, expect, it, vi } from 'vitest';
import { LoginUser, RefreshSession, RegisterUser } from '../../src/application/auth/auth-use-cases';
import type { AccessTokenService, PasswordHasher, RefreshTokenStore } from '../../src/domain/auth/ports';
import type { NewUser, User, UserRepository } from '../../src/domain/auth/user';
import { ConflictError, UnauthorizedError } from '../../src/domain/shared/errors';

class InMemoryUsers implements UserRepository {
  readonly users = new Map<string, User>();
  async findById(id: string) {
    return [...this.users.values()].find((u) => u.id === id) ?? null;
  }
  async findByEmail(email: string) {
    return this.users.get(email) ?? null;
  }
  async create(input: NewUser) {
    const user = { ...input, id: `id-${this.users.size + 1}` };
    this.users.set(user.email, user);
    return user;
  }
}

const hasher: PasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  verify: async (hash, plain) => hash === `hashed:${plain}`,
};
const tokens: AccessTokenService = {
  sign: async (claims) => `access:${claims.sub}:${claims.role}`,
  verify: async () => {
    throw new UnauthorizedError('no usado');
  },
};
const refreshTokens = (): RefreshTokenStore => ({
  issue: vi.fn(async () => 'refresh-1'),
  rotate: vi.fn(async () => ({ userId: 'id-1', token: 'refresh-2' })),
  revokeFamily: vi.fn(async () => {}),
});

describe('casos de uso de autenticación', () => {
  it('el registro público siempre crea clientes y abre sesión', async () => {
    const users = new InMemoryUsers();
    const session = await new RegisterUser(users, hasher, { tokens, refreshTokens: refreshTokens() }).execute({
      email: 'ana@test.cl',
      password: 'secreta123',
      name: 'Ana',
    });
    expect(session.user.role).toBe('client');
    expect(session.accessToken).toBe('access:id-1:client');
    expect(session.refreshToken).toBe('refresh-1');
    expect(users.users.get('ana@test.cl')!.passwordHash).toBe('hashed:secreta123');
  });

  it('rechaza un email duplicado', async () => {
    const users = new InMemoryUsers();
    const register = new RegisterUser(users, hasher, { tokens, refreshTokens: refreshTokens() });
    await register.execute({ email: 'a@test.cl', password: 'secreta123', name: 'A' });
    await expect(register.execute({ email: 'a@test.cl', password: 'otra12345', name: 'B' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('login con contraseña incorrecta o email inexistente da el mismo error', async () => {
    const users = new InMemoryUsers();
    await users.create({ email: 'b@test.cl', name: 'B', passwordHash: 'hashed:correcta1', role: 'client', agencyId: null });
    const login = new LoginUser(users, hasher, { tokens, refreshTokens: refreshTokens() });

    const wrongPassword = login.execute({ email: 'b@test.cl', password: 'incorrecta' });
    const unknownEmail = login.execute({ email: 'nadie@test.cl', password: 'incorrecta' });

    await expect(wrongPassword).rejects.toThrow('Credenciales inválidas');
    await expect(unknownEmail).rejects.toThrow('Credenciales inválidas');
  });

  it('refresh rota el token y emite un access token nuevo', async () => {
    const users = new InMemoryUsers();
    await users.create({ email: 'c@test.cl', name: 'C', passwordHash: 'x', role: 'agent', agencyId: 'ag-1' });
    const store = refreshTokens();

    const session = await new RefreshSession(users, { tokens, refreshTokens: store }).execute('refresh-1');

    expect(store.rotate).toHaveBeenCalledWith('refresh-1');
    expect(session.refreshToken).toBe('refresh-2');
    expect(session.accessToken).toBe('access:id-1:agent');
  });
});
