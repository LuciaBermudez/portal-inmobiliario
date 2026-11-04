import type { ApiErrorBody } from '@portal/shared';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../../domain/shared/errors';

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

const body = (code: string, message: string, details?: unknown): ApiErrorBody => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

/** Traduce errores de dominio a HTTP. Los 5xx nunca filtran detalles internos al cliente. */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const cause: unknown = error;
  if (cause instanceof DomainError) {
    return reply.status(STATUS_BY_CODE[cause.code] ?? 400).send(body(cause.code, cause.message, cause.details));
  }
  const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
  if (status >= 500) {
    request.log.error({ err: error }, 'error no controlado');
    return reply.status(500).send(body('INTERNAL', 'Error interno del servidor'));
  }
  return reply.status(status).send(body(error.code ?? 'HTTP_ERROR', error.message));
}
