import { z } from 'zod';
import { UuidSchema } from './common';
import { CurrencySchema, OperationSchema, PropertyTypeSchema } from './listing';

export const ImportStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed']);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

export const ImportJobSchema = z.object({
  id: UuidSchema,
  originalName: z.string(),
  status: ImportStatusSchema,
  /** Se conoce al terminar (el archivo se procesa en streaming). */
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

/** Clave de idempotencia enviada en el header `Idempotency-Key`. */
export const IdempotencyKeySchema = z
  .string({ message: 'Falta el header Idempotency-Key' })
  .trim()
  .min(8, 'Idempotency-Key demasiado corta')
  .max(100);

const emptyToNull = (value: unknown) => (value === '' || value === undefined || value === null ? null : value);
const optionalInt = z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(50).nullable());
const optionalArea = z.preprocess(emptyToNull, z.coerce.number().positive().max(1_000_000).nullable());

/**
 * Fila del CSV de carga masiva. Columnas:
 * external_id,title,description,operation,property_type,price,currency,bedrooms,bathrooms,area_m2,address,lat,lng
 */
export const CsvListingRowSchema = z.object({
  external_id: z.string().trim().min(1, 'external_id requerido').max(100),
  title: z.string().trim().min(3, 'título demasiado corto').max(200),
  description: z.string().trim().max(5000).default(''),
  operation: OperationSchema,
  property_type: PropertyTypeSchema,
  price: z.coerce.number().positive('el precio debe ser mayor a 0'),
  currency: CurrencySchema,
  bedrooms: optionalInt,
  bathrooms: optionalInt,
  area_m2: optionalArea,
  address: z.string().trim().max(300).default(''),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type CsvListingRow = z.output<typeof CsvListingRowSchema>;

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
