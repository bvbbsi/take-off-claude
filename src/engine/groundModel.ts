import * as turf from '@turf/turf';
import type {
  CandidateSite, Confidence, GroundModel, LngLat, MockDataset, SoilPolygon, SoilType, TerrainCell, Well,
} from '../types';

export const SOIL_LABELS: Record<SoilType, string> = {
  berg: 'Berg i dagen',
  moran: 'Morän',
  sand_grus: 'Sand/grus',
  silt: 'Silt',
  lera: 'Lera',
  torv_gyttja: 'Torv/gyttja',
  fyllning: 'Fyllning',
};

const CONF_ORDER: Confidence[] = ['low', 'medium', 'high'];

/** Svagaste confidence bland de angivna. */
export function weakest(...cs: Confidence[]): Confidence {
  return cs.reduce((a, b) => (CONF_ORDER.indexOf(a) <= CONF_ORDER.indexOf(b) ? a : b), 'high');
}

export function distanceKm(a: LngLat, b: LngLat): number {
  return turf.distance(a, b, { units: 'kilometers' });
}

export interface IdwResult {
  value: number;
  std: number;
  meanDistanceKm: number;
}

/**
 * Inverse Distance Weighting (potens 2). Punkter närmare än 1 m ger sitt eget värde.
 */
export function idw(points: { value: number; distanceKm: number }[], power = 2): IdwResult {
  if (points.length === 0) throw new Error('IDW kräver minst en punkt');
  const exact = points.find((p) => p.distanceKm < 0.001);
  let value: number;
  if (exact) {
    value = exact.value;
  } else {
    let num = 0;
    let den = 0;
    for (const p of points) {
      const w = 1 / p.distanceKm ** power;
      num += w * p.value;
      den += w;
    }
    value = num / den;
  }
  const mean = points.reduce((s, p) => s + p.value, 0) / points.length;
  const std = Math.sqrt(points.reduce((s, p) => s + (p.value - mean) ** 2, 0) / points.length);
  const meanDistanceKm = points.reduce((s, p) => s + p.distanceKm, 0) / points.length;
  return { value, std, meanDistanceKm };
}

function bboxOverlap(a: number[], b: number[]) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

/** Den jordartspolygon som täcker störst del av tomten (§10.1). */
export function dominantSoil(site: CandidateSite, soils: SoilPolygon[]): SoilPolygon | undefined {
  const siteBbox = turf.bbox(site.geometry);
  let best: SoilPolygon | undefined;
  let bestArea = 0;
  for (const s of soils) {
    if (!bboxOverlap(siteBbox, turf.bbox(s.geometry))) continue;
    const inter = turf.intersect(turf.featureCollection([turf.feature(site.geometry), turf.feature(s.geometry)]));
    if (!inter) continue;
    const a = turf.area(inter);
    if (a > bestArea) {
      bestArea = a;
      best = s;
    }
  }
  if (best) return best;
  // Ingen överlappning: närmaste polygon (mittpunkt i polygon)
  return soils.find((s) => turf.booleanPointInPolygon(site.centroid, s.geometry));
}

export const MAX_WELL_RADIUS_KM = 2;
export const MAX_WELLS = 10;
export const DEFAULT_GROUNDWATER_M = 2;

export interface GroundModelInput {
  site: CandidateSite;
  soil: SoilPolygon | undefined;
  wells: Well[];
  terrain: TerrainCell;
}

/** Bygger markmodellen för en plats utifrån jordart, brunnar och terräng (§10.1). */
export function buildGroundModel({ site, soil, wells, terrain }: GroundModelInput): GroundModel {
  const soilType: SoilType = soil?.soilType ?? 'moran';
  const soilRange: [number, number] = soil?.soilDepthRangeM ?? [2, 6];
  const soilConf: Confidence = soil ? soil.confidence : 'low';

  const near = wells
    .map((w) => ({ well: w, distanceKm: distanceKm(site.centroid, w.coord) }))
    .filter((w) => w.distanceKm <= MAX_WELL_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.well.id.localeCompare(b.well.id))
    .slice(0, MAX_WELLS);

  let depthToRockM: number;
  let depthUncertaintyM: number;
  let depthConfidence: Confidence;
  let meanWellDistanceKm: number | null = null;

  if (near.length >= 3) {
    const r = idw(near.map((n) => ({ value: n.well.depthToRockM, distanceKm: n.distanceKm })));
    depthToRockM = r.value;
    meanWellDistanceKm = r.meanDistanceKm;
    // Osäkerhet = spridning i brunnsvärden + avståndstillägg (0,5 m per km medelavstånd)
    depthUncertaintyM = r.std + 0.5 * r.meanDistanceKm;
    depthConfidence = near.length >= 6 && r.meanDistanceKm < 1.2 ? 'high' : 'medium';
  } else {
    depthToRockM = (soilRange[0] + soilRange[1]) / 2;
    depthUncertaintyM = (soilRange[1] - soilRange[0]) / 2 + 1;
    depthConfidence = 'low';
    if (near.length > 0) meanWellDistanceKm = near.reduce((s, n) => s + n.distanceKm, 0) / near.length;
  }

  const gwValues = near.map((n) => n.well.groundwaterLevelM).filter((v): v is number => v !== undefined);
  const groundwaterLevelM = gwValues.length > 0 ? gwValues.reduce((s, v) => s + v, 0) / gwValues.length : DEFAULT_GROUNDWATER_M;
  const groundwaterConfidence: Confidence = gwValues.length >= 3 ? 'medium' : 'low';

  const confidence = weakest(depthConfidence, soilConf, terrain.confidence);
  const r1 = (v: number) => v.toFixed(1).replace('.', ',');

  return {
    siteId: site.id,
    soilType,
    soilDepthRangeM: soilRange,
    depthToRockM: Math.round(depthToRockM * 10) / 10,
    depthUncertaintyM: Math.round(depthUncertaintyM * 10) / 10,
    wellCount: near.length,
    meanWellDistanceKm: meanWellDistanceKm === null ? null : Math.round(meanWellDistanceKm * 100) / 100,
    groundwaterLevelM: Math.round(groundwaterLevelM * 10) / 10,
    groundwaterConfidence,
    depthConfidence,
    terrain,
    confidence,
    sources: [
      { label: 'Jordart', source: soil?.source ?? 'MOCK', confidence: soilConf, value: `${SOIL_LABELS[soilType]} (${r1(soilRange[0])}–${r1(soilRange[1])} m)` },
      {
        label: 'Djup till berg',
        source: near.length >= 3 ? (near[0].well.source) : (soil?.source ?? 'MOCK'),
        confidence: depthConfidence,
        value: near.length >= 3 ? `${r1(depthToRockM)} m (IDW, ${near.length} brunnar)` : `${r1(depthToRockM)} m (jorddjupsmodell)`,
      },
      { label: 'Grundvatten', source: near[0]?.well.source ?? 'MOCK', confidence: groundwaterConfidence, value: `${r1(groundwaterLevelM)} m u. markyta` },
      { label: 'Terräng', source: terrain.source, confidence: terrain.confidence, value: `Lutning ${r1(terrain.meanSlopePct)} %, ΔH ${r1(terrain.maxElevM - terrain.minElevM)} m` },
    ],
  };
}

const cache = new WeakMap<MockDataset, Map<string, GroundModel>>();

/** Markmodeller för alla platser i ett dataset (cachat – beror inte på krav). */
export function groundModelsFor(data: MockDataset): Map<string, GroundModel> {
  const hit = cache.get(data);
  if (hit) return hit;
  const terrainBySite = new Map(data.terrain.map((t) => [t.siteId, t]));
  const out = new Map<string, GroundModel>();
  for (const site of data.sites) {
    const terrain = terrainBySite.get(site.id) ?? {
      siteId: site.id, minElevM: 0, maxElevM: 0, meanElevM: 0, meanSlopePct: 0,
      source: 'MOCK', confidence: 'low', updated: site.updated,
    };
    out.set(site.id, buildGroundModel({ site, soil: dominantSoil(site, data.soils), wells: data.wells, terrain }));
  }
  cache.set(data, out);
  return out;
}
