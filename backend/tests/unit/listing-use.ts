import { describe, expect, it, vi } from 'vitest';
import { decodeCursor, encodeCursor } from '../../src/application/listings/cursor';
import { GetListingTile, UpdateListing } from '../../src/application/listings/listing-use-cases';
import type { Listing, ListingRepository } from '../../src/domain/listing/listing';
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/domain/shared/errors';

const listing: Listing = {
  id: 'l-1',
  agencyId: 'agency-A',
  externalId: 'EXT-1',
  title: 'Casa',
  description: '',
  operation: 'sale',
  propertyType: 'house',
  price: 450_000_000,
  currency: 'COP',
  bedrooms: 3,
  bathrooms: 2,
  areaM2: 120,
  address: '',
  location: { lng: -76.53, lat: 3.45 },
  status: 'active',
  version: 3,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const repo = (): ListingRepository => ({
  findById: vi.fn(async (id: string) => (id === listing.id ? listing : null)),
  search: vi.fn(),
  update: vi.fn(async (_id, patch, version) => ({ ...listing, ...patch, version: version + 1 })),
});

describe('UpdateListing (RBAC + ABAC + bloqueo optimista)', () => {
  it('un agente de otra inmobiliaria recibe 403 y no se toca la BD', async () => {
    const listings = repo();
    const useCase = new UpdateListing(listings);
    await expect(
      useCase.execute({ id: 'u', role: 'agent', agencyId: 'agency-B' }, 'l-1', { version: 3, price: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(listings.update).not.toHaveBeenCalled();
  });

  it('un agente de la misma inmobiliaria actualiza pasando la versión esperada', async () => {
    const listings = repo();
    const result = await new UpdateListing(listings).execute(
      { id: 'u', role: 'agent', agencyId: 'agency-A' },
      'l-1',
      { version: 3, price: 4500 },
    );
    expect(listings.update).toHaveBeenCalledWith('l-1', { price: 4500 }, 3);
    expect(result.version).toBe(4);
    expect(result.price).toBe(4500);
  });

  it('404 si el aviso no existe', async () => {
    await expect(
      new UpdateListing(repo()).execute({ id: 'u', role: 'admin', agencyId: null }, 'nope', { version: 1, price: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('cursor de paginación', () => {
  it('ida y vuelta conserva microsegundos', () => {
    const cursor = { createdAt: '2026-10-13 10:00:00.123456+00', id: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('rechaza cursores manipulados', () => {
    expect(() => decodeCursor('no-es-un-cursor')).toThrow(ValidationError);
    expect(() => decodeCursor(Buffer.from('{"c":"x","i":"1"}').toString('base64url'))).toThrow(ValidationError);
  });
});

describe('GetListingTile', () => {
  it('valida el rango de coordenadas de la tesela', async () => {
    const useCase = new GetListingTile({ getTile: async () => Buffer.alloc(0) });
    await expect(useCase.execute(2, 4, 0)).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute(2, 3, 3)).resolves.toBeInstanceOf(Buffer);
  });
});
