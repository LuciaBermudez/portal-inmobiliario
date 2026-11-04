import type { z } from 'zod';
import { ValidationError } from '../../domain/shared/errors';

/** Valida la entrada con un esquema compartido; los errores salen como 400 con detalle por campo. */
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'Datos inválidos',
      result.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message })),
    );
  }
  return result.data;
}
