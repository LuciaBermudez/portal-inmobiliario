import type {
  Currency,
  GeoJsonPolygon,
  ListingStatus,
  LngLat,
  Operation,
  PropertyType,
} from '@portal/shared';

export interface Listing {
  id: string;
  agencyId: string;
  externalId: string;
  title: string;
  description: string;
  operation: Operation;
  propertyType: PropertyType;
  price: number;
  currency: Currency;
  bedrooms: number | null;
  bathrooms: number | null;
  areaM2: number | null;
  address: string;
  location: LngLat;
  status: ListingStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos de un aviso tal como llegan de una fuente externa (CSV). */
export type ListingDraft = Pick<
  Listing,
  | 'externalId'
  | 'title'
  | 'description'
  | 'operation'
  | 'propertyType'
  | 'price'
  | 'currency'
  | 'bedrooms'
  | 'bathrooms'
  | 'areaM2'
  | 'address'
  | 'location'
>;

export type ListingPatch = Partial<
  Pick<Listing, 'title' | 'description' | 'price' | 'status' | 'bedrooms' | 'bathrooms' | 'areaM2'>
>;

/** Cursor keyset: (created_at, id). `createdAt` conserva la precisión de microsegundos de Postgres. */
export interface ListingCursor {
  createdAt: string;
  id: string;
}

export interface ListingSearchCriteria {
  polygon?: GeoJsonPolygon;
  operation?: Operation;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  cursor?: ListingCursor;
  limit: number;
}

export interface ListingSearchResult {
  items: Listing[];
  next: ListingCursor | null;
}

export interface ListingRepository {
  findById(id: string): Promise<Listing | null>;
  search(criteria: ListingSearchCriteria): Promise<ListingSearchResult>;
  /**
   * Bloqueo optimista: solo actualiza si la versión coincide.
   * Lanza ConflictError si otro usuario modificó el aviso, NotFoundError si no existe.
   */
  update(id: string, patch: ListingPatch, expectedVersion: number): Promise<Listing>;
}

/** Fuente de teselas vectoriales (Mapbox Vector Tiles) de avisos activos. */
export interface ListingTileSource {
  getTile(z: number, x: number, y: number): Promise<Buffer>;
}
