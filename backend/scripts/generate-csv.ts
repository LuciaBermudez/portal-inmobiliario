import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { once } from 'node:events';
import { CSV_COLUMNS } from '@portal/shared';

const count = Number(process.argv[2] ?? 10_000);
const output = process.argv[3] ?? 'uploads/sample-listings.csv';

/** Barrio, centro aproximado [lat, lng] y factor de precio relativo (valorización de la zona). */
const BARRIOS: Array<{ name: string; lat: number; lng: number; factor: number }> = [
  { name: 'Granada', lat: 3.458, lng: -76.533, factor: 1.4 },
  { name: 'El Peñón', lat: 3.4495, lng: -76.5425, factor: 1.5 },
  { name: 'Santa Teresita', lat: 3.4535, lng: -76.5475, factor: 1.6 },
  { name: 'Normandía', lat: 3.4575, lng: -76.5455, factor: 1.4 },
  { name: 'Versalles', lat: 3.4635, lng: -76.5285, factor: 1.2 },
  { name: 'Santa Mónica Residencial', lat: 3.4695, lng: -76.5245, factor: 1.2 },
  { name: 'La Flora', lat: 3.4865, lng: -76.5195, factor: 1.1 },
  { name: 'San Fernando', lat: 3.4365, lng: -76.5405, factor: 1.2 },
  { name: 'Tequendama', lat: 3.4235, lng: -76.5425, factor: 1.0 },
  { name: 'San Antonio', lat: 3.4475, lng: -76.5375, factor: 1.0 },
  { name: 'Alameda', lat: 3.4365, lng: -76.5305, factor: 0.8 },
  { name: 'El Ingenio', lat: 3.3855, lng: -76.5245, factor: 1.2 },
  { name: 'Valle del Lili', lat: 3.3755, lng: -76.5195, factor: 1.1 },
  { name: 'Ciudad Jardín', lat: 3.3645, lng: -76.5375, factor: 1.8 },
  { name: 'Pance', lat: 3.3415, lng: -76.5335, factor: 2.0 },
  { name: 'Ciudad Córdoba', lat: 3.4095, lng: -76.4955, factor: 0.6 },
];

const TYPES = ['apartment', 'house', 'office', 'commercial', 'land'] as const;
const TITLE: Record<(typeof TYPES)[number], string> = {
  apartment: 'Apartamento',
  house: 'Casa',
  office: 'Oficina',
  commercial: 'Local comercial',
  land: 'Lote',
};
const JITTER_DEG = 0.0065; // ≈ 700 m

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;
const between = (min: number, max: number) => min + Math.random() * (max - min);
const jitter = (value: number) => (value + (Math.random() - 0.5) * 2 * JITTER_DEG).toFixed(6);
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
/** Redondea precios como se publican: arriendos al millar, ventas al millón. */
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

function address(): string {
  const via = pick(['Calle', 'Carrera', 'Avenida', 'Transversal', 'Diagonal']);
  return `${via} ${1 + Math.floor(Math.random() * 120)} # ${1 + Math.floor(Math.random() * 99)}-${10 + Math.floor(Math.random() * 89)}`;
}

await mkdir(dirname(output), { recursive: true });
const out = createWriteStream(output);
out.write(`${CSV_COLUMNS.join(',')}\n`);

for (let i = 1; i <= count; i++) {
  const type = pick(TYPES);
  // Los lotes casi nunca se arriendan: siempre venta.
  const operation = type === 'land' || Math.random() < 0.5 ? 'sale' : 'rent';
  const barrio = pick(BARRIOS);
  const invalid = Math.random() < 0.01;
  const area = Math.round(type === 'land' ? between(120, 900) : between(40, 260));

  // Arriendo mensual en COP (~1 a ~6 millones) y venta (~150 a ~1.800 millones), según barrio y área.
  const price =
    operation === 'rent'
      ? roundTo(between(14_000, 22_000) * area * barrio.factor, 10_000)
      : roundTo(between(3_000_000, 4_500_000) * area * barrio.factor, 1_000_000);

  const bedrooms = type === 'apartment' || type === 'house' ? String(1 + Math.floor(Math.random() * 4)) : '';
  const row = [
    `EXT-${i}`,
    quote(`${TITLE[type]} en ${operation === 'rent' ? 'arriendo' : 'venta'} en ${barrio.name}`),
    quote(`${TITLE[type]} de ${area} m² en ${barrio.name}, Cali. Cerca a vías principales y comercio.`),
    operation,
    type,
    invalid ? '-1' : String(price),
    'COP',
    bedrooms,
    bedrooms ? String(1 + Math.floor(Math.random() * 3)) : '',
    String(area),
    quote(`${address()}, ${barrio.name}, Cali`),
    jitter(barrio.lat),
    jitter(barrio.lng),
  ];
  if (!out.write(`${row.join(',')}\n`)) await once(out, 'drain');
}
out.end();
await once(out, 'finish');
console.log(`CSV generado: ${output} (${count} filas, Cali)`);
