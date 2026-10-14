export type UserRole = 'client' | 'seller' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  agencyId: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  agencyId: string | null;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  agencyId: string | null;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  agencyId: string | null;
}

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): Promise<string>;
}

export interface RotatedRefreshToken {
  userId: string;
  token: string;
}

export interface RefreshTokenStore {
  issue(userId: string): Promise<string>;
  rotate(refreshToken: string): Promise<RotatedRefreshToken>;
  revokeFamily(refreshToken: string): Promise<void>;
}
