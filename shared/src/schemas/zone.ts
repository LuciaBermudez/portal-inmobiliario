import { z } from 'zod';
import { UuidSchema } from './common';
import { GeoJsonPolygonSchema } from './geo';
import { CurrencySchema, OperationSchema, PropertyTypeSchema } from './listing';

export const AlertFrequencySchema = z.enum(['instant', 'daily']);
export type AlertFrequency = z.infer<typeof AlertFrequencySchema>;

export const ZoneFiltersSchema = z.object({
  operation: OperationSchema.optional(),
  propertyType: PropertyTypeSchema.optional(),
  /** Se compara contra el precio del aviso en su propia moneda. */
  maxPrice: z.number().positive().optional(),
  minBedrooms: z.number().int().min(0).max(50).optional(),
});
export type ZoneFilters = z.infer<typeof ZoneFiltersSchema>;

export const CreateZoneRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  polygon: GeoJsonPolygonSchema,
  filters: ZoneFiltersSchema.default({}),
  frequency: AlertFrequencySchema.default('instant'),
});
export type CreateZoneRequest = z.output<typeof CreateZoneRequestSchema>;
export type CreateZoneRequestInput = z.input<typeof CreateZoneRequestSchema>;

export const ZoneSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  polygon: GeoJsonPolygonSchema,
  filters: ZoneFiltersSchema,
  frequency: AlertFrequencySchema,
  createdAt: z.string(),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const NotificationSchema = z.object({
  id: UuidSchema,
  zoneId: UuidSchema,
  zoneName: z.string(),
  listing: z.object({
    id: UuidSchema,
    title: z.string(),
    price: z.number(),
    currency: CurrencySchema,
    operation: OperationSchema,
  }),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const MarkNotificationsReadSchema = z.object({
  ids: z.array(UuidSchema).min(1).max(500),
});
