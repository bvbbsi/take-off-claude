import type { Confidence } from '../types';

const nf = (d: number) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmt0 = (v: number) => nf(0).format(v);
export const fmt1 = (v: number) => nf(1).format(v);
export const fmt2 = (v: number) => nf(2).format(v);
export const fmtMSEK = (v: number) => (v >= 100 ? fmt0(v) : v >= 10 ? fmt1(v) : fmt2(v));
export const fmtKm = (v: number) => `${fmt1(v)} km`;
export const fmtQty = (v: number) => (v >= 100 ? fmt0(v) : fmt1(v));

export const CONFIDENCE_LABEL: Record<Confidence, string> = { low: 'Låg', medium: 'Medel', high: 'Hög' };
export const CONFIDENCE_CLASS: Record<Confidence, string> = {
  low: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-emerald-100 text-emerald-800',
};

export function scoreColor(v: number): string {
  if (v >= 75) return '#059669';
  if (v >= 50) return '#65a30d';
  if (v >= 30) return '#d97706';
  return '#dc2626';
}
