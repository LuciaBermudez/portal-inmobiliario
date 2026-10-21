import {
  ListingPageSchema,
  ListingSchema,
  type SearchListingsQueryInput,
  type UpdateListingRequest,
} from '@portal/shared';
import { API_BASE, requestParsed } from './http';

export const listingsApi = {
  search: (query: SearchListingsQueryInput) =>
    requestParsed(ListingPageSchema, '/listings/search', { method: 'POST', json: query }),

  get: (id: string) => requestParsed(ListingSchema, `/listings/${encodeURIComponent(id)}`),

  update: (id: string, body: UpdateListingRequest) =>
    requestParsed(ListingSchema, `/listings/${encodeURIComponent(id)}`, { method: 'PATCH', json: body }),
};

/** URL absoluta de teselas MVT (MapLibre no resuelve rutas relativas). `v` invalida la caché tras una importación. */
export function listingTilesUrl(version: number): string {
  const base = new URL(API_BASE, window.location.origin).href.replace(/\/$/, '');
  return `${base}/tiles/{z}/{x}/{y}.mvt?v=${version}`;
}
