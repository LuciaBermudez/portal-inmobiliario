import type { Actor, Role } from '@portal/shared';
import type { FastifyRequest } from 'fastify';
import type { AccessTokenService } from '../../domain/auth/ports';
import { ForbiddenError, UnauthorizedError } from '../../domain/shared/errors';

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor | null;
  }
}

/** preHandler: valida el Bearer token y adjunta el actor a la request. */
export function authenticate(tokens: AccessTokenService) {
  return async (request: FastifyRequest): Promise<void> => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('Falta el token de acceso');
    const claims = await tokens.verify(header.slice('Bearer '.length));
    request.actor = { id: claims.sub, role: claims.role, agencyId: claims.agencyId };
  };
}

/** preHandler RBAC. La autorización por atributos (ABAC) se decide en los casos de uso. */
export function requireRoles(...roles: Role[]) {
  return async (request: FastifyRequest): Promise<void> => {
    const actor = requireActor(request);
    if (!roles.includes(actor.role)) throw new ForbiddenError('Tu rol no tiene acceso a este recurso');
  };
}

export function requireActor(request: FastifyRequest): Actor {
  if (!request.actor) throw new UnauthorizedError('No autenticado');
  return request.actor;
}
