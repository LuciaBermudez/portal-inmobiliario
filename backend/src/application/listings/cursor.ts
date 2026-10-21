import type { ListingCursor } from '../../domain/listing/listing';
import { ValidationError } from '../../domain/shared/errors';

/** Cursor opaco para el cliente: base64url de { c: created_at, i: id }. */
export function encodeCursor(cursor: ListingCursor): string {
  return Buffer.from(JSON.stringify({ c: cursor.createdAt, i: cursor.id })).toString('base64url');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function decodeCursor(raw: string): ListingCursor {
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      typeof value === 'object' &&
      value !== null &&
      'c' in value &&
      'i' in value &&
      typeof value.c === 'string' &&
      typeof value.i === 'string' &&
      UUID.test(value.i) &&
      !Number.isNaN(Date.parse(value.c))
    ) {
      return { createdAt: value.c, id: value.i };
    }
  } catch {
    // cae al error de abajo
  }
  throw new ValidationError('Cursor de paginación inválido');
}
