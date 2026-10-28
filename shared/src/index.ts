import { z } from 'zod';

/* ───────────── Catálogos (deben coincidir con los CHECK de las migraciones) ───────────── */

export const RoleSchema = z.enum(['admin', 'agent', 'client']);
export type Role = z.infer<typeof RoleSchema>;

export const OperationSchema = z.enum(['sale', 'rent']);
export type Operation = z.infer<typeof OperationSchema>;

export const PropertyTypeSchema = z.enum(['house', 'apartment', 'land', 'office', 'commercial']);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

export const CurrencySchema = z.enum(['COP', 'USD']);
export type Currency = z.infer<typeof CurrencySchema>;

export const ListingStatusSchema = z.enum(['active', 'inactive']);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const ImportStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed']);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

export const AlertFrequencySchema = z.enum(['instant', 'daily']);
export type AlertFrequency = z.infer<typeof AlertFrequencySchema>;

/** Estado de una petición asíncrona en el frontend. */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

/* ───────────── Geometría (GeoJSON, WGS84) ───────────── */

/** [lng, lat] */
export const PositionSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export type Position = z.infer<typeof PositionSchema>;

export const GeoJsonPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(PositionSchema).min(4)).min(1),
});
export type GeoJsonPolygon = z.infer<typeof GeoJsonPolygonSchema>;

export const LngLatSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});
export type LngLat = z.infer<typeof LngLatSchema>;

/* ───────────── Errores HTTP y utilidades ───────────── */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const PageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const IdParamsSchema = z.object({ id: z.uuid() });

export const IdempotencyKeySchema = z.string().min(8).max(128);

/* ───────────── Autenticación ───────────── */

export const SessionUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: RoleSchema,
  agencyId: z.uuid().nullable(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

/** Quién ejecuta un caso de uso (sale del access token). */
export type Actor = Pick<SessionUser, 'id' | 'role' | 'agencyId'>;

export const RegisterRequestSchema = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(128),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: SessionUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/* ───────────── Avisos ───────────── */

export const ListingSchema = z.object({
  id: z.uuid(),
  agencyId: z.uuid(),
  externalId: z.string(),
  title: z.string(),
  description: z.string(),
  operation: OperationSchema,
  propertyType: PropertyTypeSchema,
  price: z.number(),
  currency: CurrencySchema,
  bedrooms: z.number().int().nullable(),
  bathrooms: z.number().int().nullable(),
  areaM2: z.number().nullable(),
  address: z.string(),
  location: LngLatSchema,
  status: ListingStatusSchema,
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Listing = z.infer<typeof ListingSchema>;

export const ListingPageSchema = PageSchema(ListingSchema);

export const SearchListingsQuerySchema = z.object({
  polygon: GeoJsonPolygonSchema.optional(),
  operation: OperationSchema.optional(),
  propertyType: PropertyTypeSchema.optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  minBedrooms: z.coerce.number().int().nonnegative().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type SearchListingsQuery = z.infer<typeof SearchListingsQuerySchema>;
export type SearchListingsQueryInput = z.input<typeof SearchListingsQuerySchema>;

export const UpdateListingRequestSchema = z.object({
  version: z.number().int().nonnegative(),
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  price: z.number().positive().optional(),
  status: ListingStatusSchema.optional(),
  bedrooms: z.number().int().nonnegative().nullable().optional(),
  bathrooms: z.number().int().nonnegative().nullable().optional(),
  areaM2: z.number().positive().nullable().optional(),
});
export type UpdateListingRequest = z.infer<typeof UpdateListingRequestSchema>;

/* ───────────── Carga masiva (CSV) ───────────── */

export const CSV_COLUMNS = [
  'external_id',
  'title',
  'description',
  'operation',
  'property_type',
  'price',
  'currency',
  'bedrooms',
  'bathrooms',
  'area_m2',
  'address',
  'lat',
  'lng',
] as const;

/** Celda vacía → null; si no, número. */
const optionalNumber = (inner: z.ZodNumber) =>
  z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), z.coerce.number().pipe(inner).nullable());

export const CsvListingRowSchema = z.object({
  external_id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).default(''),
  operation: OperationSchema,
  property_type: PropertyTypeSchema,
  price: z.coerce.number().positive(),
  currency: CurrencySchema.default('COP'),
  bedrooms: optionalNumber(z.number().int().nonnegative()),
  bathrooms: optionalNumber(z.number().int().nonnegative()),
  area_m2: optionalNumber(z.number().positive()),
  address: z.string().trim().min(1).max(300),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type CsvListingRow = z.infer<typeof CsvListingRowSchema>;

export const ImportJobSchema = z.object({
  id: z.uuid(),
  originalName: z.string(),
  status: ImportStatusSchema,
  totalRows: z.number().int().nullable(),
  processedRows: z.number().int(),
  insertedRows: z.number().int(),
  updatedRows: z.number().int(),
  failedRows: z.number().int(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});
export type ImportJob = z.infer<typeof ImportJobSchema>;

export const ImportRowErrorSchema = z.object({
  rowNumber: z.number().int(),
  message: z.string(),
});
export type ImportRowErrorDto = z.infer<typeof ImportRowErrorSchema>;

/* ───────────── Alertas por zona ───────────── */

export const ZoneFiltersSchema = z.object({
  operation: OperationSchema.optional(),
  propertyType: PropertyTypeSchema.optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  minBedrooms: z.number().int().nonnegative().optional(),
});
export type ZoneFilters = z.infer<typeof ZoneFiltersSchema>;

export const CreateZoneRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  polygon: GeoJsonPolygonSchema,
  filters: ZoneFiltersSchema.default({}),
  frequency: AlertFrequencySchema.default('instant'),
});
export type CreateZoneRequest = z.infer<typeof CreateZoneRequestSchema>;
export type CreateZoneRequestInput = z.input<typeof CreateZoneRequestSchema>;

export const ZoneSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  polygon: GeoJsonPolygonSchema,
  filters: ZoneFiltersSchema,
  frequency: AlertFrequencySchema,
  createdAt: z.string(),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const NotificationSchema = z.object({
  id: z.uuid(),
  zoneId: z.uuid(),
  zoneName: z.string(),
  listing: ListingSchema.pick({ id: true, title: true, price: true, currency: true }),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const MarkNotificationsReadSchema = z.object({ ids: z.array(z.uuid()).min(1).max(500) });

/* ───────────── Tiempo real (Socket.IO) ───────────── */

export interface ServerToClientEvents {
  'import:progress': (job: ImportJob) => void;
  'notification:new': (notification: Notification) => void;
}

/* ───────────── Permisos (RBAC + ABAC), compartidos por backend y frontend ───────────── */

export const canImportListings = (actor: Actor): boolean => actor.role === 'admin' || actor.role === 'agent';

export const canViewImport = (actor: Actor, job: { userId: string; agencyId: string }): boolean =>
  actor.role === 'admin' || (actor.role === 'agent' && actor.agencyId === job.agencyId) || actor.id === job.userId;

export const canEditListing = (actor: Actor, listing: { agencyId: string }): boolean =>
  actor.role === 'admin' || (actor.role === 'agent' && actor.agencyId === listing.agencyId);

export const canManageZone = (actor: Actor, zone: { userId: string }): boolean => actor.id === zone.userId;
