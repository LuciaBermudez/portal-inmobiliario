import { describe, expect, it } from 'vitest';
import { canEditListing, canImportListings, canManageZone, type Actor } from '../src';

describe('políticas RBAC + ABAC', () => {
  const agent: Actor = { id: 'u1', role: 'agent', agencyId: 'a1' };

  it('un agente edita avisos de su inmobiliaria pero no de otra', () => {
    expect(canEditListing(agent, { agencyId: 'a1' })).toBe(true);
    expect(canEditListing(agent, { agencyId: 'a2' })).toBe(false);
  });

  it('un cliente no edita ni importa', () => {
    const client: Actor = { id: 'u2', role: 'client', agencyId: null };
    expect(canEditListing(client, { agencyId: 'a1' })).toBe(false);
    expect(canImportListings(client)).toBe(false);
  });

  it('admin edita cualquier aviso', () => {
    expect(canEditListing({ id: 'x', role: 'admin', agencyId: null }, { agencyId: 'a9' })).toBe(true);
  });

  it('sin sesión no hay permisos', () => {
    expect(canEditListing(null, { agencyId: 'a1' })).toBe(false);
    expect(canImportListings(null)).toBe(false);
  });

  it('las zonas solo las gestiona su dueño', () => {
    expect(canManageZone(agent, { userId: 'u1' })).toBe(true);
    expect(canManageZone(agent, { userId: 'otro' })).toBe(false);
  });
});
