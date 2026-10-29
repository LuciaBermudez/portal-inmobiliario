import { describe, expect, it } from 'vitest';
import { CsvListingRowSchema } from '../src';

describe('CsvListingRowSchema', () => {
  const row = {
    external_id: 'A-1',
    title: 'Apartamento en Granada',
    description: '',
    operation: 'rent',
    property_type: 'apartment',
    price: '2500000',
    currency: 'COP',
    bedrooms: '',
    bathrooms: '2',
    area_m2: '',
    address: 'Avenida 9N # 12-30, Granada',
    lat: '3.458',
    lng: '-76.533',
  };

  it('convierte strings del CSV y vacíos a null', () => {
    const parsed = CsvListingRowSchema.parse(row);
    expect(parsed.price).toBe(2500000);
    expect(parsed.bedrooms).toBeNull();
    expect(parsed.bathrooms).toBe(2);
  });

  it('rechaza precio no positivo', () => {
    expect(CsvListingRowSchema.safeParse({ ...row, price: '-1' }).success).toBe(false);
  });

  it('rechaza monedas no soportadas', () => {
    expect(CsvListingRowSchema.safeParse({ ...row, currency: 'CLP' }).success).toBe(false);
  });
});
