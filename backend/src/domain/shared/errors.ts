/**
 * Errores de dominio. No conocen HTTP: la capa de interfaces los traduce a códigos de estado.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  override readonly code = 'VALIDATION_ERROR';
}

export class UnauthorizedError extends DomainError {
  override readonly code = 'UNAUTHORIZED';
}

export class ForbiddenError extends DomainError {
  override readonly code = 'FORBIDDEN';
}

export class NotFoundError extends DomainError {
  override readonly code = 'NOT_FOUND';
}

/** Conflicto de concurrencia (versión obsoleta) o de unicidad. */
export class ConflictError extends DomainError {
  override readonly code = 'CONFLICT';
}
