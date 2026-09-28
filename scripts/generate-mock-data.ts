/**
 * Deterministisk generering av mock-data (SPEC §6).
 *
 *   npm run generate:mock
 *
 * Använder en seedad slumpgenerator så att identisk data skapas varje gång.
 * Utdata skrivs till src/data/mock/*.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import seedrandom from 'seedrandom';
import * as turf from '@turf/turf';
import type { Polygon } from 'geojson';
import { TOWNS, type Town } from '../src/config/towns.ts';
import type {
  CandidateSite, Confidence, LngLat, PlanningArea, PlanningKind, PlanStatus, Quarry, SoilPolygon,
  SoilType, Substation, TerrainCell, Well,
} from '../src/types/index.ts';

const SEED = 'sitefinder-mvp-v1';
const UPDATED = '2026-01-15';
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/mock');

const rng = seedrandom(SEED);
const rand = (min = 0, max = 1) => min + (max - min) * rng();
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const chance = (p: number) => rng() < p;
const randIn = ([min, max]: [number, number]) => rand(min, max);
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function weighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const roundCoord = (c: number[]): LngLat => [round(c[0], 5), round(c[1], 5)];

/** Förskjuter en punkt `km` kilometer i riktning `bearing` (grader). */
function offset([lng, lat]: LngLat, km: number, bearing: number): LngLat {
  const p = turf.destination([lng, lat], km, bearing, { units: 'kilometers' });
  return roundCoord(p.geometry.coordinates);
}
function jitter(town: Town, minKm: number, maxKm: number): LngLat {
  return offset([town.lng, town.lat], rand(minKm, maxKm), rand(0, 360));
}

/** Roterad rektangel (tomtgräns) med given yta i m². */
function rectangle(center: LngLat, areaM2: number, aspect: number, rotationDeg: number): Polygon {
  const w = Math.sqrt(areaM2 * aspect);
  const h = areaM2 / w;
  const corners: [number, number][] = [
    [-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2],
  ];
  const rad = (rotationDeg * Math.PI) / 180;
  const latScale = 111_320;
  const lngScale = 111_320 * Math.cos((center[1] * Math.PI) / 180);
  const ring = corners.map(([x, y]) => {
    const rx = x * Math.cos(rad) - y * Math.sin(rad);
    const ry = x * Math.sin(rad) + y * Math.cos(rad);
    return roundCoord([center[0] + rx / lngScale, center[1] + ry / latScale]);
  });
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

/** Oregelbunden polygon (för jordarter och planområden). */
function blob(center: LngLat, radiusKm: number, irregularity = 0.35, points = 10): Polygon {
  const ring: LngLat[] = [];
  for (let i = 0; i < points; i++) {
    const bearing = (360 / points) * i;
    const r = radiusKm * (1 - irregularity / 2 + rand(0, irregularity));
    ring.push(offset(center, r, bearing));
  }
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

const NAME_PREFIX = ['Norr', 'Söder', 'Väster', 'Öster', 'Björk', 'Gran', 'Tall', 'Ek', 'Sjö', 'Berg', 'Mal', 'Hed', 'Myr', 'Lind', 'Ås', 'Sand', 'Stor', 'Lill', 'Hög', 'Kvarn', 'Råg', 'Hag', 'Ängs', 'Mo', 'Lunda'];
const NAME_SUFFIX = ['byn', 'viken', 'dalen', 'hult', 'näs', 'marken', 'berga', 'torp', 'holmen', 'ängen', 'fältet', 'heden', 'mossen', 'backen', 'skogen', 'vallen'];
const usedNames = new Set<string>();
function placeName(): string {
  for (let i = 0; i < 200; i++) {
    const n = pick(NAME_PREFIX) + pick(NAME_SUFFIX);
    if (!usedNames.has(n)) {
      usedNames.add(n);
      return n;
    }
  }
  const n = `${pick(NAME_PREFIX)}${pick(NAME_SUFFIX)} ${usedNames.size}`;
  usedNames.add(n);
  return n;
}

const OPERATORS: Record<Substation['gridLevel'], string[]> = {
  transmission: ['Stamnätet (mock)'],
  region: ['Regionnät Nord (mock)', 'Regionnät Mitt (mock)', 'Regionnät Syd (mock)'],
  lokal: ['Nätbolag Nord (mock)', 'Nätbolag Mälardalen (mock)', 'Nätbolag Väst (mock)', 'Nätbolag Syd (mock)', 'Kommunala Elnät (mock)'],
};

// ---------------------------------------------------------------------------
// 1. Stationer (40–50: ~8 transmission, ~15 region, resten lokal)
// ---------------------------------------------------------------------------
function generateSubstations(): Substation[] {
  const levels: Substation['gridLevel'][] = [
    ...Array<Substation['gridLevel']>(8).fill('transmission'),
    ...Array<Substation['gridLevel']>(15).fill('region'),
    ...Array<Substation['gridLevel']>(23).fill('lokal'),
  ];
  // Varje ort får minst en station, resterande fördelas slumpmässigt.
  const townOrder: Town[] = [...TOWNS];
  while (townOrder.length < levels.length) townOrder.push(pick(TOWNS));
  // Blanda nivåerna så att transmission hamnar på olika orter.
  for (let i = levels.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [levels[i], levels[j]] = [levels[j], levels[i]];
  }

  return levels.map((gridLevel, i) => {
    const town = townOrder[i];
    const voltageKv: Substation['voltageKv'] =
      gridLevel === 'transmission' ? pick([400, 400, 220] as const)
        : gridLevel === 'region' ? pick([130, 130, 70] as const)
          : pick([40, 20] as const);

    const baseCap = gridLevel === 'transmission' ? rand(150, 600) : gridLevel === 'region' ? rand(30, 200) : rand(4, 35);
    const areaFactor = town.elArea === 'SE1' ? rand(1.1, 1.6)
      : town.elArea === 'SE2' ? rand(0.9, 1.4)
        : town.elArea === 'SE4' ? rand(0.5, 0.9)
          : town.congested ? rand(0.05, 0.3) : rand(0.35, 0.8);
    const capacityWithdrawalMW = Math.round(baseCap * areaFactor);
    const queueFactor = town.congested ? rand(2, 5) : town.elArea === 'SE3' ? rand(0.6, 2) : town.elArea === 'SE4' ? rand(0.5, 1.5) : rand(0.1, 0.8);
    const queuedMW = Math.round(baseCap * queueFactor * 0.5);

    const plannedUpgrades = chance(0.3)
      ? Array.from({ length: chance(0.25) ? 2 : 1 }, () => {
        const year = randInt(2027, 2032);
        const addedMW = Math.round(baseCap * rand(0.4, 1.2));
        return { year, addedMW, description: pick(['Ny transformator', 'Förstärkt ledning', 'Utbyggnad ställverk', 'Ny anslutningspunkt']) + ' (mock)' };
      }).sort((a, b) => a.year - b.year)
      : [];

    const ratio = capacityWithdrawalMW / Math.max(1, capacityWithdrawalMW + queuedMW);
    const status: Substation['status'] = ratio > 0.5 ? 'green' : ratio > 0.25 ? 'amber' : 'red';

    return {
      id: `ss-${String(i + 1).padStart(3, '0')}`,
      name: `Station ${placeName()} ${voltageKv} kV (mock)`,
      coord: jitter(town, 3, 25),
      voltageKv,
      gridLevel,
      operator: pick(OPERATORS[gridLevel]),
      elArea: town.elArea,
      capacityWithdrawalMW,
      queuedMW,
      plannedUpgrades,
      status,
      source: 'MOCK',
      confidence: gridLevel === 'transmission' ? 'high' : gridLevel === 'region' ? 'medium' : 'low',
      updated: UPDATED,
    } satisfies Substation;
  });
}

// ---------------------------------------------------------------------------
// 2. Kandidatplatser (80–100)
// ---------------------------------------------------------------------------
function generateSites(): { sites: CandidateSite[]; townOf: Map<string, Town> } {
  const sites: CandidateSite[] = [];
  const townOf = new Map<string, Town>();
  let n = 0;
  for (const town of TOWNS) {
    const count = town.elArea === 'SE1' || town.elArea === 'SE2' ? 4 : 3;
    for (let k = 0; k < count; k++) {
      n++;
      const id = `site-${String(n).padStart(3, '0')}`;
      const sizeClass = weighted<[number, number]>([[[1.5, 8], 0.3], [[8, 25], 0.3], [[20, 80], 0.4]]);
      const areaHa = round(randIn(sizeClass), 1);
      const centroid = jitter(town, 3, 25);
      const geometry = rectangle(centroid, areaHa * 10_000, rand(0.6, 2.2), rand(0, 180));
      const planStatus = weighted<PlanStatus>([
        ['detaljplan_klar', 0.2], ['planarbete_pagar', 0.2], ['op_utpekad', 0.25], ['oplanerad', 0.35],
      ]);
      const site: CandidateSite = {
        id,
        name: `${pick(['Verksamhetsområde', 'Industriområde', 'Etableringsområde', 'Kvarteret'])} ${placeName()} (mock)`,
        municipality: town.name,
        elArea: town.elArea,
        geometry,
        centroid,
        areaHa,
        ownership: weighted([['kommunal', 0.45], ['privat', 0.35], ['statlig', 0.1], ['okand', 0.1]]),
        planStatus,
        distanceToRailKm: round(randIn(weighted<[number, number]>([[[0.2, 2], 0.3], [[2, 8], 0.4], [[8, 30], 0.3]])), 1),
        distanceToMajorRoadKm: round(randIn(weighted<[number, number]>([[[0.1, 3], 0.55], [[3, 12], 0.45]])), 1),
        districtHeatingNearby: chance(town.highland ? 0.4 : 0.55),
        fiberNearby: chance(0.65),
        source: 'MOCK',
        confidence: weighted<Confidence>([['high', 0.3], ['medium', 0.5], ['low', 0.2]]),
        updated: UPDATED,
      };
      sites.push(site);
      townOf.set(id, town);
    }
  }
  return { sites, townOf };
}

// ---------------------------------------------------------------------------
// 3. Jordarter (1–3 per kandidatplats plus omgivning)
// ---------------------------------------------------------------------------
const SOIL_DEPTH: Record<SoilType, [number, number]> = {
  berg: [0, 1],
  moran: [1, 8],
  sand_grus: [2, 12],
  silt: [3, 15],
  lera: [5, 30],
  torv_gyttja: [1, 5],
  fyllning: [1, 4],
};

function soilWeights(town: Town): [SoilType, number][] {
  if (town.clayProne) {
    return [['lera', 0.45], ['silt', 0.08], ['moran', 0.2], ['sand_grus', 0.1], ['berg', 0.08], ['torv_gyttja', 0.04], ['fyllning', 0.05]];
  }
  if (town.highland) {
    return [['moran', 0.45], ['berg', 0.2], ['sand_grus', 0.15], ['silt', 0.05], ['lera', 0.06], ['torv_gyttja', 0.07], ['fyllning', 0.02]];
  }
  return [['moran', 0.35], ['lera', 0.2], ['sand_grus', 0.15], ['berg', 0.12], ['silt', 0.08], ['torv_gyttja', 0.05], ['fyllning', 0.05]];
}

function depthRange(soil: SoilType): [number, number] {
  const [lo, hi] = SOIL_DEPTH[soil];
  const a = rand(lo, hi);
  const b = rand(lo, hi);
  const min = round(Math.min(a, b), 1);
  const max = round(Math.max(Math.max(a, b), min + (hi - lo) * 0.15), 1);
  return [min, Math.min(max, hi)];
}

function generateSoils(sites: CandidateSite[], townOf: Map<string, Town>): SoilPolygon[] {
  const soils: SoilPolygon[] = [];
  let n = 0;
  const add = (geometry: Polygon, soilType: SoilType) => {
    n++;
    soils.push({
      id: `soil-${String(n).padStart(4, '0')}`,
      geometry,
      soilType,
      soilDepthRangeM: depthRange(soilType),
      source: 'MOCK',
      confidence: weighted<Confidence>([['high', 0.25], ['medium', 0.6], ['low', 0.15]]),
      updated: UPDATED,
    });
  };
  for (const site of sites) {
    const town = townOf.get(site.id)!;
    const sideKm = Math.sqrt(site.areaHa / 100);
    // Dominerande polygon som täcker tomten med marginal
    add(blob(site.centroid, sideKm * 1.1 + 0.4, 0.25, 12), weighted(soilWeights(town)));
    // 0–2 mindre polygoner som delvis överlappar tomten
    const extra = randInt(0, 2);
    for (let i = 0; i < extra; i++) {
      const c = offset(site.centroid, rand(0.2, 0.6) * sideKm + 0.1, rand(0, 360));
      add(blob(c, sideKm * rand(0.25, 0.45) + 0.1, 0.4, 9), weighted(soilWeights(town)));
    }
  }
  // Omgivning runt orterna
  for (const town of TOWNS) {
    for (let i = 0; i < 4; i++) {
      add(blob(jitter(town, 2, 30), rand(1.5, 5), 0.5, 11), weighted(soilWeights(town)));
    }
  }
  return soils;
}

// ---------------------------------------------------------------------------
// 4. Terräng per kandidatplats
// ---------------------------------------------------------------------------
function generateTerrain(sites: CandidateSite[], townOf: Map<string, Town>): TerrainCell[] {
  return sites.map((site) => {
    const town = townOf.get(site.id)!;
    // De flesta tomter är flacka; branta lägen förekommer främst i Norrland/höglänta lägen.
    const meanSlopePct = round(12 * rng() ** (town.highland ? 1.6 : town.clayProne ? 3 : 2.2), 1);
    const sideM = Math.sqrt(site.areaHa * 10_000);
    // Höjdskillnad = f(lutning, tomtstorlek)
    const deltaH = round((meanSlopePct / 100) * sideM * 0.3, 1);
    const meanElevM = round(town.highland ? rand(20, 350) : town.clayProne ? rand(3, 45) : rand(15, 150), 1);
    return {
      siteId: site.id,
      minElevM: round(meanElevM - deltaH / 2, 1),
      maxElevM: round(meanElevM + deltaH / 2, 1),
      meanElevM,
      meanSlopePct,
      source: 'MOCK',
      confidence: chance(0.8) ? 'high' : 'medium',
      updated: UPDATED,
    };
  });
}

// ---------------------------------------------------------------------------
// 5. Brunnar (800–1 200, tätare runt kandidatplatser)
// ---------------------------------------------------------------------------
function soilAt(coord: LngLat, soils: SoilPolygon[]): SoilPolygon | undefined {
  // Senast tillagda (minsta, mest specifika) polygon vinner vid överlapp.
  for (let i = soils.length - 1; i >= 0; i--) {
    const s = soils[i];
    if (turf.booleanPointInPolygon(coord, s.geometry)) return s;
  }
  return undefined;
}

function wellDepth(soilType: SoilType | undefined, range: [number, number] | undefined, town: Town): number {
  switch (soilType) {
    case 'berg': return rand(0, 1);
    case 'moran': return rand(Math.max(1, range![0]), Math.min(8, range![1] + 1));
    case 'sand_grus': return rand(range![0], range![1] + 2);
    case 'silt': return rand(range![0], range![1] + 3);
    case 'lera': return rand(Math.max(5, range![0]), Math.min(40, range![1] + 8));
    case 'torv_gyttja': return rand(range![0] + 0.5, range![1] + 4);
    case 'fyllning': return rand(1, 6);
    default: return town.clayProne ? rand(3, 20) : rand(0.5, 8);
  }
}

function generateWells(sites: CandidateSite[], townOf: Map<string, Town>, soils: SoilPolygon[]): Well[] {
  const wells: Well[] = [];
  const add = (coord: LngLat, town: Town) => {
    const soil = soilAt(coord, soils);
    const depthToRockM = round(wellDepth(soil?.soilType, soil?.soilDepthRangeM, town), 1);
    wells.push({
      id: `well-${String(wells.length + 1).padStart(5, '0')}`,
      coord,
      depthToRockM,
      totalDepthM: round(depthToRockM + rand(25, 140), 0),
      groundwaterLevelM: chance(0.7) ? round(rand(0.3, 6), 1) : undefined,
      source: 'MOCK',
      confidence: weighted<Confidence>([['high', 0.3], ['medium', 0.5], ['low', 0.2]]),
      updated: UPDATED,
    });
  };
  for (const site of sites) {
    const town = townOf.get(site.id)!;
    // ~15 % av platserna får mycket glest brunnsunderlag (→ låg confidence)
    const count = chance(0.15) ? randInt(0, 2) : randInt(5, 12);
    for (let i = 0; i < count; i++) {
      add(offset(site.centroid, rand(0.05, 1.9) ** 1.2, rand(0, 360)), town);
    }
  }
  // Glesare bakgrund runt orterna tills vi når ~1 000
  while (wells.length < 1000) {
    const town = pick(TOWNS);
    add(jitter(town, 0.5, 30), town);
  }
  return wells;
}

// ---------------------------------------------------------------------------
// 6. Täkter/mottagningar (40–60)
// ---------------------------------------------------------------------------
function generateQuarries(): Quarry[] {
  const quarries: Quarry[] = [];
  const count = 52;
  for (let i = 0; i < count; i++) {
    const town = i < TOWNS.length ? TOWNS[i] : pick(TOWNS);
    const type = weighted<Quarry['type']>([['bergtakt', 0.4], ['grustakt', 0.2], ['mottagning', 0.2], ['kombinerad', 0.2]]);
    const label = { bergtakt: 'Bergtäkt', grustakt: 'Grustäkt', mottagning: 'Massmottagning', kombinerad: 'Täkt & mottagning' }[type];
    quarries.push({
      id: `q-${String(i + 1).padStart(3, '0')}`,
      name: `${label} ${placeName()} (mock)`,
      coord: jitter(town, 3, 25),
      type,
      acceptsMasses: type === 'mottagning' || type === 'kombinerad' || (type === 'bergtakt' && chance(0.3)),
      rockQuality: type === 'mottagning' ? 'lag' : weighted([['hog', 0.35], ['medel', 0.45], ['lag', 0.2]]),
      source: 'MOCK',
      confidence: 'medium',
      updated: UPDATED,
    });
  }
  return quarries;
}

// ---------------------------------------------------------------------------
// 7. Planområden och restriktioner (60–80)
// ---------------------------------------------------------------------------
function generatePlanning(sites: CandidateSite[]): PlanningArea[] {
  const areas: PlanningArea[] = [];
  const add = (geometry: Polygon, kind: PlanningKind, note?: string) => {
    const blocking = kind === 'natura2000' || kind === 'naturreservat';
    areas.push({
      id: `plan-${String(areas.length + 1).padStart(3, '0')}`,
      geometry,
      kind,
      blocking,
      note,
      source: 'MOCK',
      confidence: blocking || kind === 'riksintresse' ? 'high' : 'medium',
      updated: UPDATED,
    });
  };
  const sitePolys = sites.map((s) => s.geometry);
  const overlapsAnySite = (g: Polygon) => sitePolys.some((p) => turf.booleanIntersects(p, g));

  // Planområden kopplade till platsernas planstatus
  for (const site of sites) {
    const sideKm = Math.sqrt(site.areaHa / 100);
    if (site.planStatus === 'detaljplan_klar') {
      add(blob(site.centroid, sideKm * 0.75 + 0.15, 0.15, 8), chance(0.5) ? 'detaljplan_industri' : 'detaljplan_verksamhet', 'Antagen detaljplan (mock)');
    } else if (site.planStatus === 'op_utpekad' && chance(0.6)) {
      add(blob(site.centroid, sideKm * 1.2 + 0.5, 0.3, 9), 'op_utredningsomrade', 'Utpekat i översiktsplan (mock)');
    }
  }

  // ~10 % av platserna överlappar ett blockerande område
  const blockedIdx = new Set<number>();
  while (blockedIdx.size < Math.round(sites.length * 0.1)) blockedIdx.add(Math.floor(rng() * sites.length));
  for (const idx of [...blockedIdx].sort((a, b) => a - b)) {
    const site = sites[idx];
    const sideKm = Math.sqrt(site.areaHa / 100);
    const c = offset(site.centroid, sideKm * 0.5, rand(0, 360));
    const kind = chance(0.6) ? 'natura2000' : 'naturreservat';
    add(blob(c, sideKm * 0.6 + 0.4, 0.3, 10), kind, kind === 'natura2000' ? 'Natura 2000-område (mock)' : 'Naturreservat (mock)');
  }

  // Riksintressen nära några platser (icke-blockerande, påverkar planpoäng)
  for (const site of sites) {
    if (!chance(0.12)) continue;
    const sideKm = Math.sqrt(site.areaHa / 100);
    const c = offset(site.centroid, sideKm * 0.7 + rand(0.4, 0.9), rand(0, 360));
    add(blob(c, rand(0.3, 0.7), 0.3, 9), 'riksintresse', pick(['Riksintresse kulturmiljö (mock)', 'Riksintresse naturvård (mock)', 'Riksintresse friluftsliv (mock)']));
  }

  // Fristående restriktioner i omgivningen som inte berör kandidatplatser
  let guard = 0;
  while (areas.length < 72 && guard++ < 500) {
    const town = pick(TOWNS);
    const kind = weighted<PlanningKind>([['natura2000', 0.3], ['naturreservat', 0.25], ['strandskydd', 0.25], ['riksintresse', 0.2]]);
    const g = blob(jitter(town, 3, 30), rand(0.8, 3), 0.45, 10);
    if (overlapsAnySite(g)) continue;
    add(g, kind, kind === 'strandskydd' ? 'Strandskydd 100 m (mock)' : undefined);
  }
  return areas;
}

// ---------------------------------------------------------------------------
function write(name: string, data: unknown) {
  writeFileSync(resolve(OUT_DIR, `${name}.json`), JSON.stringify(data) + '\n');
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const substations = generateSubstations();
  const { sites, townOf } = generateSites();
  const soils = generateSoils(sites, townOf);
  const terrain = generateTerrain(sites, townOf);
  const wells = generateWells(sites, townOf, soils);
  const quarries = generateQuarries();
  const planning = generatePlanning(sites);

  write('sites', sites);
  write('substations', substations);
  write('soils', soils);
  write('terrain', terrain);
  write('wells', wells);
  write('quarries', quarries);
  write('planning', planning);

  console.log(
    `Mock-data genererad (seed "${SEED}"): ${sites.length} platser, ${substations.length} stationer, ` +
    `${wells.length} brunnar, ${soils.length} jordartspolygoner, ${quarries.length} täkter, ${planning.length} planområden.`,
  );
}

main();
