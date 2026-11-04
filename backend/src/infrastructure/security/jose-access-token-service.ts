import { RoleSchema } from '@portal/shared';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import type { AccessTokenClaims, AccessTokenService } from '../../domain/auth/ports';
import { UnauthorizedError } from '../../domain/shared/errors';

const ISSUER = 'portal-inmobiliario';

const ClaimsSchema = z.object({
  sub: z.string().uuid(),
  role: RoleSchema,
  agencyId: z.string().uuid().nullable(),
});

export class JoseAccessTokenService implements AccessTokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttl: string,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  sign(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ role: claims.role, agencyId: claims.agencyId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.sub)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(this.ttl)
      .sign(this.key);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, algorithms: ['HS256'] });
      return ClaimsSchema.parse({ sub: payload.sub, role: payload['role'], agencyId: payload['agencyId'] });
    } catch {
      throw new UnauthorizedError('Token de acceso inválido o expirado');
    }
  }
}
