import type { FeatureCollection, LineString } from 'geojson';

// Förenklade gränser mellan elområdena SE1–SE4 (endast för orientering, ej exakta).
export const EL_AREA_BORDERS: FeatureCollection<LineString, { name: string }> = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'SE1/SE2' }, geometry: { type: 'LineString', coordinates: [[14.3, 65.95], [16.2, 65.75], [18.2, 65.5], [20.0, 65.2], [21.3, 65.0], [21.6, 64.95]] } },
    { type: 'Feature', properties: { name: 'SE2/SE3' }, geometry: { type: 'LineString', coordinates: [[12.2, 61.35], [13.6, 61.2], [15.0, 61.15], [16.3, 61.05], [17.2, 61.0], [17.5, 61.0]] } },
    { type: 'Feature', properties: { name: 'SE3/SE4' }, geometry: { type: 'LineString', coordinates: [[12.45, 56.95], [13.4, 56.8], [14.4, 56.62], [15.3, 56.5], [16.0, 56.4], [16.35, 56.3]] } },
  ],
};

export const EL_AREA_LABELS: { name: string; coord: [number, number] }[] = [
  { name: 'SE1', coord: [19.2, 67.3] },
  { name: 'SE2', coord: [16.2, 63.4] },
  { name: 'SE3', coord: [14.6, 59.0] },
  { name: 'SE4', coord: [13.7, 56.2] },
];
