import type { Role } from '@portal/shared';

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  agencyId: string | null;
}

/** Access token de vida corta (JWT). El cliente lo guarda SOLO en memoria. */
export interface AccessTokenService {
  sign(claims: AccessTokenClaims): Promise<string>;
  /** Lanza UnauthorizedError si es inválido o expiró. */
  verify(token: string): Promise<AccessTokenClaims>;
}

/**
 * Refresh tokens opacos con rotación y detección de reuso por familia:
 * presentar un token ya rotado revoca toda la familia (posible robo).
 */
export interface RefreshTokenStore {
  issue(userId: string, familyId?: string): Promise<string>;
  /** Lanza UnauthorizedError si es inválido, expiró o fue reutilizado. */
  rotate(token: string): Promise<{ userId: string; token: string }>;
  revokeFamily(token: string): Promise<void>;
}
