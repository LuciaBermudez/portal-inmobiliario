import type { Role } from './schemas/auth';

/**
 * Políticas de acceso (RBAC + ABAC) como funciones puras.
 * El backend las aplica (autoridad); el frontend las usa solo para mostrar/ocultar UI.
 */
export interface Actor {
  id: string;
  role: Role;
  agencyId: string | null;
}

/** RBAC: admin/agent. ABAC: un agente solo edita avisos de SU inmobiliaria. */
export function canEditListing(actor: Actor | null, listing: { agencyId: string }): boolean {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  return actor.role === 'agent' && actor.agencyId !== null && actor.agencyId === listing.agencyId;
}

/** Importar requiere rol de gestión y pertenecer a una inmobiliaria (los avisos quedan a su nombre). */
export function canImportListings(actor: Actor | null): boolean {
  if (!actor) return false;
  return (actor.role === 'admin' || actor.role === 'agent') && actor.agencyId !== null;
}

export function canViewImport(actor: Actor | null, job: { agencyId: string }): boolean {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  return actor.role === 'agent' && actor.agencyId === job.agencyId;
}

/** Las zonas/alertas son privadas de su dueño. */
export function canManageZone(actor: Actor | null, zone: { userId: string }): boolean {
  return actor !== null && actor.id === zone.userId;
}
