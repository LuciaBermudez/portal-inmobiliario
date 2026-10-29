import { describe, expect, it } from 'vitest';
import { GeoJsonPolygonSchema, SearchListingsQuerySchema } from '../src';

const square = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-76.56, 3.40],
      [-76.50, 3.40],
      [-76.50, 3.46],
      [-76.56, 3.46],
      [-76.56, 3.40],
    ],
  ],
};

describe('GeoJsonPolygonSchema', () => {
  it('acepta un anillo cerrado', () => {
    expect(GeoJsonPolygonSchema.safeParse(square).success).toBe(true);
  });

  it('rechaza un anillo abierto', () => {
    const open = { ...square, coordinates: [square.coordinates[0]!.slice(0, 4)] };
    expect(GeoJsonPolygonSchema.safeParse(open).success).toBe(false);
  });

  it('rechaza coordenadas fuera de rango', () => {
    const bad = { ...square, coordinates: [[[-200, 0], [0, 0], [0, 1], [-200, 0]]] };
    expect(GeoJsonPolygonSchema.safeParse(bad).success).toBe(false);
  });
});

describe('SearchListingsQuerySchema', () => {
  it('aplica límite por defecto', () => {
    expect(SearchListingsQuerySchema.parse({}).limit).toBe(30);
  });

  it('rechaza minPrice > maxPrice', () => {
    expect(SearchListingsQuerySchema.safeParse({ minPrice: 10, maxPrice: 5 }).success).toBe(false);
  });
});
