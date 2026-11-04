import { IdParamsSchema, SearchListingsQuerySchema, UpdateListingRequestSchema } from '@portal/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../../container';
import { authenticate, requireActor, requireRoles } from '../auth';
import { parseOrThrow } from '../validation';

const TileParamsSchema = z.object({
  z: z.coerce.number().int().min(0).max(22),
  x: z.coerce.number().int().min(0),
  y: z
    .string()
    .regex(/^\d+(\.mvt)?$/, 'Tesela inválida')
    .transform((value) => Number.parseInt(value, 10)),
});

export function listingRoutes(c: Container): FastifyPluginAsync {
  const { useCases } = c;
  return async (app) => {
    // POST porque el polígono GeoJSON puede ser grande para una query string.
    app.post('/search', async (request) =>
      useCases.searchListings.execute(parseOrThrow(SearchListingsQuerySchema, request.body)),
    );

    app.get('/:id', async (request) => {
      const { id } = parseOrThrow(IdParamsSchema, request.params);
      return useCases.getListing.execute(id);
    });

    app.patch('/:id', { preHandler: [authenticate(c.tokens), requireRoles('admin', 'agent')] }, async (request) => {
      const { id } = parseOrThrow(IdParamsSchema, request.params);
      const body = parseOrThrow(UpdateListingRequestSchema, request.body);
      return useCases.updateListing.execute(requireActor(request), id, body);
    });
  };
}

export function tileRoutes(c: Container): FastifyPluginAsync {
  return async (app) => {
    app.get(
      '/:z/:x/:y',
      { config: { rateLimit: { max: 3000, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const { z: zoom, x, y } = parseOrThrow(TileParamsSchema, request.params);
        const tile = await c.useCases.getTile.execute(zoom, x, y);
        return reply
          .header('content-type', 'application/vnd.mapbox-vector-tile')
          .header('cache-control', 'public, max-age=30')
          .send(tile);
      },
    );
  };
}
