import pg from 'pg';
import type { EventPublisher, Logger, RealtimeEvent } from '../../domain/shared/ports';
import type { Pool } from '../db/pool';

export const EVENTS_CHANNEL = 'portal_events';

export interface EventEnvelope {
  room: string;
  event: RealtimeEvent;
}

export const userRoom = (userId: string) => `user:${userId}`;

/**
 * El worker no tiene sockets abiertos: publica con `pg_notify` y cada instancia de la API
 * (que sí los tiene) lo recibe vía `LISTEN` y lo reenvía a la sala del usuario.
 * Payload máximo de NOTIFY: 8000 bytes — los eventos son DTOs pequeños.
 */
export class PgNotifyEventPublisher implements EventPublisher {
  constructor(private readonly pool: Pool) {}

  async publishToUser(userId: string, event: RealtimeEvent): Promise<void> {
    const envelope: EventEnvelope = { room: userRoom(userId), event };
    await this.pool.query('SELECT pg_notify($1, $2)', [EVENTS_CHANNEL, JSON.stringify(envelope)]);
  }
}

/** Conexión dedicada con LISTEN (no puede salir del pool) y reconexión con backoff exponencial. */
export class PgEventListener {
  private client: pg.Client | null = null;
  private stopped = false;
  private attempt = 0;

  constructor(
    private readonly connectionString: string,
    private readonly onEvent: (envelope: EventEnvelope) => void,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    const client = new pg.Client({ connectionString: this.connectionString, application_name: 'portal-listener' });
    client.on('notification', (message) => {
      if (message.channel !== EVENTS_CHANNEL || !message.payload) return;
      try {
        this.onEvent(JSON.parse(message.payload) as EventEnvelope);
      } catch (error) {
        this.logger.warn('evento realtime inválido', { error: String(error) });
      }
    });
    client.on('error', (error) => {
      this.logger.error('conexión LISTEN caída', { error: error.message });
      void this.reconnect();
    });
    await client.connect();
    await client.query(`LISTEN ${EVENTS_CHANNEL}`);
    this.client = client;
    this.attempt = 0;
  }

  private async reconnect(): Promise<void> {
    await this.client?.end().catch(() => undefined);
    this.client = null;
    if (this.stopped) return;
    const delay = Math.min(30_000, 500 * 2 ** this.attempt++);
    setTimeout(() => {
      this.start().catch((error: unknown) => {
        this.logger.error('reintento de LISTEN fallido', { error: String(error) });
        void this.reconnect();
      });
    }, delay);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.client?.end().catch(() => undefined);
    this.client = null;
  }
}
