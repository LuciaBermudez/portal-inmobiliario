import {
  canManageZone,
  type Actor,
  type CreateZoneRequest,
  type Notification,
  type Zone as ZoneDto,
} from '@portal/shared';
import type { NotificationRepository, Zone, ZoneRepository } from '';
import { ForbiddenError, NotFoundError } from '';
import type { EventPublisher, Logger, Mailer } from '';

const MAX_ZONES_PER_USER = 20;

export const toZoneDto = (zone: Zone): ZoneDto => ({
  id: zone.id,
  name: zone.name,
  polygon: zone.polygon,
  filters: zone.filters,
  frequency: zone.frequency,
  createdAt: zone.createdAt.toISOString(),
});

export class CreateZone {
  constructor(private readonly zones: ZoneRepository) {}

  async execute(actor: Actor, request: CreateZoneRequest): Promise<ZoneDto> {
    const existing = await this.zones.listByUser(actor.id);
    if (existing.length >= MAX_ZONES_PER_USER) {
      throw new ForbiddenError(`Puedes tener como máximo ${MAX_ZONES_PER_USER} zonas de alerta`);
    }
    return toZoneDto(await this.zones.create({ userId: actor.id, ...request }));
  }
}

export class ListZones {
  constructor(private readonly zones: ZoneRepository) {}

  async execute(actor: Actor): Promise<ZoneDto[]> {
    return (await this.zones.listByUser(actor.id)).map(toZoneDto);
  }
}

export class DeleteZone {
  constructor(private readonly zones: ZoneRepository) {}

  async execute(actor: Actor, id: string): Promise<void> {
    const zone = await this.zones.findById(id);
    if (!zone || !canManageZone(actor, zone)) throw new NotFoundError('Zona no encontrada');
    await this.zones.delete(id);
  }
}

/**
 * Cruza avisos recién importados con las zonas guardadas y notifica.
 * La restricción UNIQUE(zone_id, listing_id) garantiza que un reintento nunca notifica dos veces.
 */
export class MatchNewListings {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly notifications: NotificationRepository,
    private readonly events: EventPublisher,
  ) {}

  async execute(listingIds: string[]): Promise<number> {
    if (listingIds.length === 0) return 0;
    const matches = await this.zones.findMatches(listingIds);
    if (matches.length === 0) return 0;
    const created = await this.notifications.insertMany(matches);
    await Promise.all(
      created
        .filter((c) => c.frequency === 'instant')
        .map((c) => this.events.publishToUser(c.userId, { name: 'notification:new', payload: c.notification })),
    );
    return created.length;
  }
}

/** Resumen diario por email (job programado con cron en la cola). */
export class SendDailyDigests {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly mailer: Mailer,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<number> {
    const digests = await this.notifications.claimPendingDigests();
    for (const digest of digests) {
      const lines = digest.items.map(
        (n) => `• [${n.zoneName}] ${n.listing.title} — ${n.listing.price} ${n.listing.currency}`,
      );
      try {
        await this.mailer.send({
          to: digest.email,
          subject: `${digest.items.length} nuevas propiedades en tus zonas`,
          text: lines.join('\n'),
        });
      } catch (error) {
        this.logger.error('fallo al enviar el resumen', { userId: digest.userId, error: String(error) });
      }
    }
    return digests.length;
  }
}

export class ListNotifications {
  constructor(private readonly notifications: NotificationRepository) {}

  execute(actor: Actor): Promise<Notification[]> {
    return this.notifications.listByUser(actor.id, 100);
  }
}

export class MarkNotificationsRead {
  constructor(private readonly notifications: NotificationRepository) {}

  execute(actor: Actor, ids: string[]): Promise<void> {
    return this.notifications.markRead(actor.id, ids);
  }
}
