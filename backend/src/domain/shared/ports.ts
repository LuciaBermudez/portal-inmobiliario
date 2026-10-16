import type { Readable } from 'node:stream';
import type { ServerToClientEvents } from '@portal/shared';

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Almacenamiento de archivos (disco local en desarrollo, S3/MinIO en la nube). */
export interface ObjectStorage {
  put(key: string, body: Readable): Promise<{ bytes: number }>;
  get(key: string): Promise<Readable>;
}

/** Unión discriminada { name, payload } derivada del contrato de eventos compartido. */
export type RealtimeEvent = {
  [K in keyof ServerToClientEvents]: { name: K; payload: Parameters<ServerToClientEvents[K]>[0] };
}[keyof ServerToClientEvents];

export interface EventPublisher {
  publishToUser(userId: string, event: RealtimeEvent): Promise<void>;
}

export interface Mailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}
