import {
  canEditListing,
  type Actor,
  type Listing as ListingDto,
  type Page,
  type SearchListingsQuery,
  type UpdateListingRequest,
} from '@portal/shared';
import type { Listing, ListingRepository, ListingTileSource } from '';
import { ForbiddenError, NotFoundError, ValidationError } from '';
import { decodeCursor, encodeCursor } from './cursor';

export const toListingDto = (l: Listing): ListingDto => ({
  id: l.id,
  agencyId: l.agencyId,
  externalId: l.externalId,
  title: l.title,
  description: l.description,
  operation: l.operation,
  propertyType: l.propertyType,
  price: l.price,
  currency: l.currency,
  bedrooms: l.bedrooms,
  bathrooms: l.bathrooms,
  areaM2: l.areaM2,
  address: l.address,
  location: l.location,
  status: l.status,
  version: l.version,
  createdAt: l.createdAt.toISOString(),
  updatedAt: l.updatedAt.toISOString(),
});

export class SearchListings {
  constructor(private readonly listings: ListingRepository) {}

  async execute(query: SearchListingsQuery): Promise<Page<ListingDto>> {
    const { cursor, ...criteria } = query;
    const result = await this.listings.search({
      ...criteria,
      cursor: cursor ? decodeCursor(cursor) : undefined,
    });
    return {
      items: result.items.map(toListingDto),
      nextCursor: result.next ? encodeCursor(result.next) : null,
    };
  }
}

export class GetListing {
  constructor(private readonly listings: ListingRepository) {}

  async execute(id: string): Promise<ListingDto> {
    const listing = await this.listings.findById(id);
    if (!listing) throw new NotFoundError('Aviso no encontrado');
    return toListingDto(listing);
  }
}

export class UpdateListing {
  constructor(private readonly listings: ListingRepository) {}

  async execute(actor: Actor, id: string, request: UpdateListingRequest): Promise<ListingDto> {
    const listing = await this.listings.findById(id);
    if (!listing) throw new NotFoundError('Aviso no encontrado');
    if (!canEditListing(actor, listing)) {
      throw new ForbiddenError('Solo puedes editar avisos de tu inmobiliaria');
    }
    const { version, ...patch } = request;
    return toListingDto(await this.listings.update(id, patch, version));
  }
}

export class GetListingTile {
  static readonly MAX_ZOOM = 22;

  constructor(private readonly tiles: ListingTileSource) {}

  async execute(z: number, x: number, y: number): Promise<Buffer> {
    const max = 2 ** z;
    if (z < 0 || z > GetListingTile.MAX_ZOOM || x < 0 || y < 0 || x >= max || y >= max) {
      throw new ValidationError('Coordenadas de tesela fuera de rango');
    }
    return this.tiles.getTile(z, x, y);
  }
}
