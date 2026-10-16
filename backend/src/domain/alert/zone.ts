import type { AlertFrequency, GeoJsonPolygon, Notification, ZoneFilters } from '@portal/shared';

export interface Zone {
  id: string;
  userId: string;
  name: string;
  polygon: GeoJsonPolygon;
  filters: ZoneFilters;
  frequency: AlertFrequency;
  createdAt: Date;
}

export interface NewZone {
  userId: string;
  name: string;
  polygon: GeoJsonPolygon;
  filters: ZoneFilters;
  frequency: AlertFrequency;
}

/** Un aviso nuevo que cae dentro de una zona y cumple sus filtros. */
export interface ZoneMatch {
  zoneId: string;
  userId: string;
  listingId: string;
}

export interface ZoneRepository {
  /** Lanza ValidationError si el polígono no es topológicamente válido. */
  create(zone: NewZone): Promise<Zone>;
  findById(id: string): Promise<Zone | null>;
  listByUser(userId: string): Promise<Zone[]>;
  delete(id: string): Promise<void>;
  /** Consulta espacial inversa: qué zonas contienen a cada aviso nuevo. */
  findMatches(listingIds: string[]): Promise<ZoneMatch[]>;
}

export interface CreatedNotification {
  userId: string;
  frequency: AlertFrequency;
  notification: Notification;
}

export interface Digest {
  userId: string;
  email: string;
  items: Notification[];
}

export interface NotificationRepository {
  /** Ignora duplicados (UNIQUE zone_id, listing_id) y devuelve solo las notificaciones realmente nuevas. */
  insertMany(matches: ZoneMatch[]): Promise<CreatedNotification[]>;
  listByUser(userId: string, limit: number): Promise<Notification[]>;
  markRead(userId: string, ids: string[]): Promise<void>;
  /**
   * Reclama atómicamente (UPDATE ... RETURNING) las notificaciones de zonas diarias pendientes.
   * Dos ejecuciones concurrentes nunca reclaman la misma notificación.
   */
  claimPendingDigests(): Promise<Digest[]>;
}

export interface AlertQueue {
  enqueueMatch(listingIds: string[]): Promise<void>;
}
