import { z } from 'zod';

export const UuidSchema = z.string().uuid();

export const IdParamsSchema = z.object({ id: UuidSchema });

/** Página con paginación por cursor (keyset), nunca OFFSET. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Forma única de los errores que devuelve la API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
