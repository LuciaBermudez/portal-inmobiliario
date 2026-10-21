import type { LoginRequest, RegisterRequest, SessionUser } from '@portal/shared';
import type { AccessTokenService, PasswordHasher, RefreshTokenStore } from '../../domain/auth/ports';
import type { User, UserRepository } from '../../domain/auth/user';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../domain/shared/errors';



export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export interface SessionServices {
  tokens: AccessTokenService;
  refreshTokens: RefreshTokenStore;
}

export const toSessionUser = (user: User): SessionUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  agencyId: user.agencyId,
});

async function openSession({ tokens, refreshTokens }: SessionServices, user: User): Promise<Session> {
  const [accessToken, refreshToken] = await Promise.all([
    tokens.sign({ sub: user.id, role: user.role, agencyId: user.agencyId }),
    refreshTokens.issue(user.id),
  ]);
  return { accessToken, refreshToken, user: toSessionUser(user) };
}

export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly session: SessionServices,
  ) {}

  async execute(input: RegisterRequest): Promise<Session> {
    if (await this.users.findByEmail(input.email)) throw new ConflictError('El email ya está registrado');
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash: await this.hasher.hash(input.password),
      role: 'client',
      agencyId: null,
    });
    return openSession(this.session, user);
  }
}


export class LoginUser {
  private decoyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly session: SessionServices,
  ) {}

  async execute(input: LoginRequest): Promise<Session> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      this.decoyHash ??= this.hasher.hash('decoy-password-for-constant-time');
      await this.hasher.verify(await this.decoyHash, input.password);
      throw new UnauthorizedError('Credenciales inválidas');
    }
    if (!(await this.hasher.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedError('Credenciales inválidas');
    }
    return openSession(this.session, user);
  }
}
export class RefreshSession {
  constructor(
    private readonly users: UserRepository,
    private readonly session: SessionServices,
  ) {}

  async execute(refreshToken: string): Promise<Session> {
    const { userId, token } = await this.session.refreshTokens.rotate(refreshToken);
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedError('Sesión inválida');
    const accessToken = await this.session.tokens.sign({ sub: user.id, role: user.role, agencyId: user.agencyId });
    return { accessToken, refreshToken: token, user: toSessionUser(user) };
  }
}

export class Logout {
  constructor(private readonly refreshTokens: RefreshTokenStore) {}

  async execute(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.refreshTokens.revokeFamily(refreshToken);
  }
}

export class GetCurrentUser {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<SessionUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');
    return toSessionUser(user);
  }
}
