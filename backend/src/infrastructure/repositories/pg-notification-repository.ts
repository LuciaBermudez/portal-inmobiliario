import type { AlertFrequency, Currency, Notification, Operation } from '@portal/shared';
import type {
  CreatedNotification,
  Digest,
  NotificationRepository,
  ZoneMatch,
} from '../../domain/alert/zone';
import type { Pool } from '../db/pool';

interface NotificationRow {
  id: string;
  user_id: string;
  zone_id: string;
  listing_id: string;
  created_at: Date;
  read_at: Date | null;
  zone_name: string;
  frequency: AlertFrequency;
  title: string;
  price: number;
  currency: Currency;
  operation: Operation;
}

const toNotification = (r: NotificationRow): Notification => ({
  id: r.id,
  zoneId: r.zone_id,
  zoneName: r.zone_name,
  listing: { id: r.listing_id, title: r.title, price: r.price, currency: r.currency, operation: r.operation },
  createdAt: r.created_at.toISOString(),
  readAt: r.read_at?.toISOString() ?? null,
});

export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: Pool) {}

  async insertMany(matches: ZoneMatch[]): Promise<CreatedNotification[]> {
    if (matches.length === 0) return [];
    const { rows } = await this.pool.query<NotificationRow>(
      `WITH ins AS (
         INSERT INTO notifications (user_id, zone_id, listing_id)
         SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::uuid[])
         ON CONFLICT ON CONSTRAINT notifications_once DO NOTHING
         RETURNING id, user_id, zone_id, listing_id, created_at, read_at
       )
       SELECT ins.*, z.name AS zone_name, z.frequency, l.title, l.price, l.currency, l.operation
       FROM ins
       JOIN zones z ON z.id = ins.zone_id
       JOIN listings l ON l.id = ins.listing_id`,
      [matches.map((m) => m.userId), matches.map((m) => m.zoneId), matches.map((m) => m.listingId)],
    );
    return rows.map((r) => ({ userId: r.user_id, frequency: r.frequency, notification: toNotification(r) }));
  }

  async listByUser(userId: string, limit: number): Promise<Notification[]> {
    const { rows } = await this.pool.query<NotificationRow>(
      `SELECT n.id, n.user_id, n.zone_id, n.listing_id, n.created_at, n.read_at,
              z.name AS zone_name, z.frequency, l.title, l.price, l.currency, l.operation
       FROM notifications n
       JOIN zones z ON z.id = n.zone_id
       JOIN listings l ON l.id = n.listing_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map(toNotification);
  }

  async markRead(userId: string, ids: string[]): Promise<void> {
    await this.pool.query(
      'UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL',
      [userId, ids],
    );
  }

  async claimPendingDigests(): Promise<Digest[]> {
    // Un único UPDATE ... RETURNING: si dos workers corren a la vez, el segundo re-evalúa
    // `digested_at IS NULL` tras el bloqueo de fila y no reclama nada repetido.
    const { rows } = await this.pool.query<NotificationRow & { email: string }>(
      `UPDATE notifications n SET digested_at = now()
       FROM zones z, listings l, users u
       WHERE n.zone_id = z.id AND l.id = n.listing_id AND u.id = n.user_id
         AND z.frequency = 'daily' AND n.digested_at IS NULL
       RETURNING n.id, n.user_id, n.zone_id, n.listing_id, n.created_at, n.read_at,
                 z.name AS zone_name, z.frequency, l.title, l.price, l.currency, l.operation, u.email`,
    );
    const byUser = new Map<string, Digest>();
    for (const row of rows) {
      const digest = byUser.get(row.user_id) ?? { userId: row.user_id, email: row.email, items: [] };
      digest.items.push(toNotification(row));
      byUser.set(row.user_id, digest);
    }
    return [...byUser.values()];
  }
}
