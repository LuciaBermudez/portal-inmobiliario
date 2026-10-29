import { z } from 'zod';
import { UuidSchema } from './common';
import { GeoJsonPolygonSchema, LngLatSchema } from './geo';

export const OperationSchema = z.enum(['sale', 'rent']);
export type Operation = z.infer<typeof OperationSchema>;

export const PropertyTypeSchema = z.enum(['house', 'apartment', 'land', 'office', 'commercial']);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

export const CurrencySchema = z.enum(['COP', 'USD']);
export type Currency = z.infer<typeof CurrencySchema>;

export const ListingStatusSchema = z.enum(['active', 'inactive']);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const ListingSchema = z.object({
  id: UuidSchema,
  agencyId: UuidSchema,
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
  /** Versión para control de concurrencia optimista. */
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Listing = z.infer<typeof ListingSchema>;

export const ListingPageSchema = z.object({
  items: z.array(ListingSchema),
  nextCursor: z.string().nullable(),
});
export type ListingPage = z.infer<typeof ListingPageSchema>;

export const SearchListingsQuerySchema = z
  .object({
    polygon: GeoJsonPolygonSchema.optional(),
    operation: OperationSchema.optional(),
    propertyType: PropertyTypeSchema.optional(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().positive().optional(),
    minBedrooms: z.number().int().min(0).max(50).optional(),
    cursor: z.string().max(300).optional(),
    limit: z.number().int().min(1).max(100).default(30),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'El precio mínimo no puede superar al máximo',
    path: ['minPrice'],
  });
export type SearchListingsQuery = z.output<typeof SearchListingsQuerySchema>;
export type SearchListingsQueryInput = z.input<typeof SearchListingsQuerySchema>;

export const UpdateListingRequestSchema = z
  .object({
    version: z.number().int().positive(),
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    price: z.number().positive().optional(),
    status: ListingStatusSchema.optional(),
    bedrooms: z.number().int().min(0).max(50).nullable().optional(),
    bathrooms: z.number().int().min(0).max(50).nullable().optional(),
    areaM2: z.number().positive().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 1, { message: 'Debes modificar al menos un campo' });
export type UpdateListingRequest = z.infer<typeof UpdateListingRequestSchema>;
