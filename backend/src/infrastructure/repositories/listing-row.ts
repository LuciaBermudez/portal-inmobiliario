import type { Currency, ListingStatus, Operation, PropertyType } from '@portal/shared';
import type { Listing } from '../../domain/listing/listing';

export interface ListingRow {
  id: string;
  agency_id: string;
  external_id: string;
  title: string;
  description: string;
  operation: Operation;
  property_type: PropertyType;
  price: number;
  currency: Currency;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  address: string;
  lng: number;
  lat: number;
  status: ListingStatus;
  version: number;
  created_at: Date;
  updated_at: Date;
  cursor_ts: string;
}

/** Columnas comunes. `cursor_ts` conserva los microsegundos de created_at (Date de JS solo tiene ms). */
export const LISTING_COLUMNS = `
  l.id, l.agency_id, l.external_id, l.title, l.description, l.operation, l.property_type,
  l.price, l.currency, l.bedrooms, l.bathrooms, l.area_m2, l.address,
  ST_X(l.geom) AS lng, ST_Y(l.geom) AS lat,
  l.status, l.version, l.created_at, l.updated_at, l.created_at::text AS cursor_ts`;

export const toListing = (r: ListingRow): Listing => ({
  id: r.id,
  agencyId: r.agency_id,
  externalId: r.external_id,
  title: r.title,
  description: r.description,
  operation: r.operation,
  propertyType: r.property_type,
  price: r.price,
  currency: r.currency,
  bedrooms: r.bedrooms,
  bathrooms: r.bathrooms,
  areaM2: r.area_m2,
  address: r.address,
  location: { lng: r.lng, lat: r.lat },
  status: r.status,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
