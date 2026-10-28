import type { Currency, ImportStatus, Operation, PropertyType } from '@portal/shared';

export const OPERATION_LABEL: Record<Operation, string> = { sale: 'Venta', rent: 'Arriendo' };

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  house: 'Casa',
  apartment: 'Apartamento',
  land: 'Lote',
  office: 'Oficina',
  commercial: 'Local comercial',
};

export const IMPORT_STATUS_LABEL: Record<ImportStatus, string> = {
  queued: 'En cola',
  processing: 'Procesando',
  completed: 'Completada',
  failed: 'Fallida',
};

const LOCALE = 'es-CO';
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function formatPrice(price: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
}

export const formatNumber = (value: number) => integer.format(value);

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
}
