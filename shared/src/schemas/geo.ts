import { z } from 'zod';

export const MAX_POLYGON_VERTICES = 500;

/** Posición GeoJSON [lng, lat] en WGS84. */
export const PositionSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export type Position = z.infer<typeof PositionSchema>;

/**
 * Polígono GeoJSON simple: un único anillo exterior cerrado (sin huecos).
 * La validez topológica (auto-intersecciones) la verifica PostGIS.
 */
export const GeoJsonPolygonSchema = z
  .object({
    type: z.literal('Polygon'),
    coordinates: z
      .array(z.array(PositionSchema).min(4, 'Un polígono necesita al menos 3 vértices').max(MAX_POLYGON_VERTICES + 1))
      .length(1, 'Solo se admite un anillo exterior (sin huecos)'),
  })
  .refine(
    (polygon) => {
      const ring = polygon.coordinates[0] ?? [];
      const first = ring[0];
      const last = ring[ring.length - 1];
      return first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1];
    },
    { message: 'El anillo del polígono debe estar cerrado (primer vértice = último)' },
  );
export type GeoJsonPolygon = z.infer<typeof GeoJsonPolygonSchema>;

export const LngLatSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});
export type LngLat = z.infer<typeof LngLatSchema>;
