import type { StyleSpecification } from 'maplibre-gl';
import type { PlanningKind, Quarry, SoilType, Substation } from '../../types';

export const POSITRON_STYLE = 'https://tiles.openfreemap.org/styles/positron';

/** Fallback om OpenFreeMap inte går att nå: OSM-raster med attribution. */
export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.6, 'raster-opacity': 0.9 } }],
};

export const SOIL_COLORS: Record<SoilType, string> = {
  berg: '#e11d48',
  moran: '#65a30d',
  sand_grus: '#facc15',
  silt: '#fb923c',
  lera: '#60a5fa',
  torv_gyttja: '#78350f',
  fyllning: '#9ca3af',
};

export const STATUS_COLORS: Record<Substation['status'], string> = {
  green: '#16a34a',
  amber: '#f59e0b',
  red: '#dc2626',
};

export const VOLTAGE_RADIUS: Record<Substation['voltageKv'], number> = {
  400: 10, 220: 8.5, 130: 7, 70: 6, 40: 5, 20: 4,
};

/** Färgsteg för brunnar efter djup till berg (m). */
export const WELL_STEPS: [number, string][] = [
  [0, '#b91c1c'],
  [2, '#f97316'],
  [5, '#eab308'],
  [10, '#22c55e'],
  [20, '#0ea5e9'],
  [30, '#1e3a8a'],
];

export const PLANNING_COLORS: Partial<Record<PlanningKind, string>> = {
  detaljplan_industri: '#7c3aed',
  detaljplan_verksamhet: '#a855f7',
  op_utredningsomrade: '#c4b5fd',
};

export const RESTRICTION_COLORS: Partial<Record<PlanningKind, string>> = {
  natura2000: '#15803d',
  naturreservat: '#166534',
  riksintresse: '#b45309',
  strandskydd: '#0369a1',
};

export const PLANNING_KIND_LABELS: Record<PlanningKind, string> = {
  detaljplan_industri: 'Detaljplan industri',
  detaljplan_verksamhet: 'Detaljplan verksamhet',
  op_utredningsomrade: 'ÖP-utredningsområde',
  riksintresse: 'Riksintresse',
  natura2000: 'Natura 2000',
  strandskydd: 'Strandskydd',
  naturreservat: 'Naturreservat',
};

export const QUARRY_ICONS: Record<Quarry['type'], string> = {
  bergtakt: '⛰',
  grustakt: '◒',
  mottagning: '⤓',
  kombinerad: '⛰',
};

export const QUARRY_LABELS: Record<Quarry['type'], string> = {
  bergtakt: 'Bergtäkt',
  grustakt: 'Grustäkt',
  mottagning: 'Massmottagning',
  kombinerad: 'Täkt och mottagning',
};

export const RESTRICTION_KINDS: PlanningKind[] = ['riksintresse', 'natura2000', 'strandskydd', 'naturreservat'];
export const PLANNING_KINDS: PlanningKind[] = ['detaljplan_industri', 'detaljplan_verksamhet', 'op_utredningsomrade'];
