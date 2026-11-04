import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { RefreshTokenStore } from '../../domain/auth/ports';
import { UnauthorizedError } from '../../domain/shared/errors';
import { withTransaction, type Pool } from '../db/pool';

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

type RotationOutcome =
  | { kind: 'ok'; userId: string; token: string }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'reuse' };

/**
 * Refresh tokens opacos (solo se persiste su hash) con rotación en cada uso.
 * Si llega un token ya rotado, alguien lo copió: se revoca TODA la familia (sesión).
 */
export class PgRefreshTokenStore implements RefreshTokenStore {
  constructor(
    private readonly pool: Pool,
    private readonly ttlDays: number,
  ) {}

  async issue(userId: string, familyId: string = randomUUID()): Promise<string> {
    const token = newToken();
    await this.pool.query(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(days => $4))`,
      [userId, familyId, sha256(token), this.ttlDays],
    );
    return token;
  }

  async rotate(token: string): Promise<{ userId: string; token: string }> {
    const outcome = await withTransaction(this.pool, async (client): Promise<RotationOutcome> => {
      // FOR UPDATE serializa dos refresh simultáneos con el mismo token: el segundo verá el token ya rotado.
      const { rows } = await client.query<{
        id: string;
        user_id: string;
        family_id: string;
        expired: boolean;
        revoked_at: Date | null;
      }>(
        `SELECT id, user_id, family_id, expires_at <= now() AS expired, revoked_at
         FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
        [sha256(token)],
      );
      const current = rows[0];
      if (!current) return { kind: 'invalid' };
      if (current.revoked_at) {
        await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [
          current.family_id,
        ]);
        return { kind: 'reuse' }; // se hace COMMIT de la revocación antes de rechazar
      }
      if (current.expired) return { kind: 'expired' };

      const next = newToken();
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
         VALUES ($1, $2, $3, now() + make_interval(days => $4)) RETURNING id`,
        [current.user_id, current.family_id, sha256(next), this.ttlDays],
      );
      await client.query('UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1', [
        current.id,
        inserted.rows[0]!.id,
      ]);
      return { kind: 'ok', userId: current.user_id, token: next };
    });

    switch (outcome.kind) {
      case 'ok':
        return { userId: outcome.userId, token: outcome.token };
      case 'reuse':
        throw new UnauthorizedError('Se detectó reutilización del token de sesión; la sesión fue revocada');
      case 'expired':
        throw new UnauthorizedError('La sesión expiró');
      case 'invalid':
        throw new UnauthorizedError('Sesión inválida');
    }
  }

  async revokeFamily(token: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1) AND revoked_at IS NULL`,
      [sha256(token)],
    );
  }
}
