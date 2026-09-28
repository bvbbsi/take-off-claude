import * as turf from '@turf/turf';
import type { UnitPrices } from '../config/unitPrices';
import { WEIGHTS } from '../config/weights';
import { countyOfMunicipality } from '../config/towns';
import type {
  CandidateSite, ExcludedSite, GroundModel, MockDataset, PlanStatus, Quarry, RankingResult, Requirements,
  ScoredSite, ScoreKey, StationEval, SubScores, Substation,
} from '../types';
import { distanceKm, groundModelsFor } from './groundModel';
import { recommendFoundation } from './foundation';
import { computeEarthworks } from './earthworks';
import { CURRENT_YEAR, PLAN_STATUS_LABELS } from './requirements';
import { buildReasons, buildWarnings } from './reasons';

export const QUEUE_AHEAD_SHARE = 0.5;
export const NO_POWER_YEAR = 2035;
export const RAIL_REQUIRED_KM = 5;
export const RIKSINTRESSE_BUFFER_KM = 0.5;
export const TOP_N = 10;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Effekt och tid till effekt (§9.2)
// ---------------------------------------------------------------------------
export function voltageFits(voltageKv: number, powerMW: number): boolean {
  if (powerMW > 50) return voltageKv >= 130;
  if (powerMW >= 10) return voltageKv >= 40;
  return false;
}

export function evaluateStation(station: Substation, distKm: number, req: Pick<Requirements, 'powerMW' | 'targetConnectionYear'>): StationEval {
  const queueAhead = station.queuedMW * QUEUE_AHEAD_SHARE;
  const upgrades = [...station.plannedUpgrades].sort((a, b) => a.year - b.year);
  const upgradesByTarget = upgrades.filter((u) => u.year <= req.targetConnectionYear).reduce((s, u) => s + u.addedMW, 0);
  const availableAtTargetMW = station.capacityWithdrawalMW + upgradesByTarget - queueAhead;
  const ratioAtTarget = availableAtTargetMW / req.powerMW;
  const ratioToday = (station.capacityWithdrawalMW - queueAhead) / req.powerMW;

  let yearToPower = NO_POWER_YEAR;
  if (ratioToday >= 1) {
    yearToPower = CURRENT_YEAR;
  } else {
    let cum = 0;
    for (const u of upgrades) {
      cum += u.addedMW;
      if ((station.capacityWithdrawalMW + cum - queueAhead) / req.powerMW >= 1) {
        yearToPower = u.year;
        break;
      }
    }
  }

  let powerScore = (clamp(ratioAtTarget, 0, 1.5) / 1.5) * 100;
  powerScore -= Math.min(20, Math.max(0, distKm - 2));
  if (voltageFits(station.voltageKv, req.powerMW)) powerScore += 5;
  powerScore = clamp(powerScore, 0, 100);

  return { station, distanceKm: distKm, availableAtTargetMW, ratioToday, ratioAtTarget, yearToPower, powerScore };
}

export function timeToPowerScore(yearToPower: number, targetYear: number): number {
  if (yearToPower <= targetYear) return 100;
  return Math.max(0, 100 - 25 * (yearToPower - targetYear));
}

export function planningScore(planStatus: PlanStatus, nearRiksintresse: boolean): number {
  const base = { detaljplan_klar: 100, planarbete_pagar: 70, op_utpekad: 50, oplanerad: 25 }[planStatus];
  return clamp(base - (nearRiksintresse ? 20 : 0), 0, 100);
}

export function logisticsScore(site: CandidateSite, req: Requirements): number {
  let s = 50;
  if (site.distanceToMajorRoadKm < 3) s += 20;
  if (site.distanceToRailKm < 2) s += 15 + (req.needsRail ? 15 : 0);
  if (site.fiberNearby) s += req.facilityType === 'datacenter' ? 20 : 10;
  if (site.districtHeatingNearby && req.wantsDistrictHeating) s += 15;
  return clamp(s, 0, 100);
}

/** Andel av värdena som är strikt lägre än x, normerat till 0–1. */
export function percentileRank(x: number, values: number[]): number {
  if (values.length <= 1) return 0;
  const below = values.filter((v) => v < x).length;
  return below / (values.length - 1);
}

// ---------------------------------------------------------------------------
// Kravoberoende förberäkningar per plats (cachas)
// ---------------------------------------------------------------------------
interface SiteStatic {
  blocking: string[];
  nearRiksintresse: boolean;
  stations: { station: Substation; distanceKm: number }[];
  nearestQuarry: { quarry: Quarry; distanceKm: number } | null;
  nearestReceiver: { quarry: Quarry; distanceKm: number } | null;
  ground: GroundModel;
}

const KIND_LABEL: Record<string, string> = {
  natura2000: 'Natura 2000',
  naturreservat: 'Naturreservat',
  riksintresse: 'Riksintresse',
  strandskydd: 'Strandskydd',
};

const staticCache = new WeakMap<MockDataset, Map<string, SiteStatic>>();

function nearest(site: CandidateSite, quarries: Quarry[]) {
  let best: { quarry: Quarry; distanceKm: number } | null = null;
  for (const q of quarries) {
    const d = distanceKm(site.centroid, q.coord);
    if (!best || d < best.distanceKm || (d === best.distanceKm && q.id < best.quarry.id)) best = { quarry: q, distanceKm: d };
  }
  return best;
}

export function siteStatics(data: MockDataset): Map<string, SiteStatic> {
  const hit = staticCache.get(data);
  if (hit) return hit;
  const grounds = groundModelsFor(data);
  const blockingAreas = data.planning.filter((p) => p.blocking);
  const riksBuffers = data.planning
    .filter((p) => p.kind === 'riksintresse' && !p.blocking)
    .map((p) => turf.buffer(turf.feature(p.geometry), RIKSINTRESSE_BUFFER_KM, { units: 'kilometers' }))
    .filter((f): f is NonNullable<typeof f> => !!f);
  const suppliers = data.quarries.filter((q) => q.type !== 'mottagning');
  const receivers = data.quarries.filter((q) => q.acceptsMasses);

  const out = new Map<string, SiteStatic>();
  for (const site of data.sites) {
    const blocking = blockingAreas
      .filter((p) => turf.booleanIntersects(site.geometry, p.geometry))
      .map((p) => `Överlappar ${KIND_LABEL[p.kind] ?? p.kind}${p.note ? ` – ${p.note}` : ''}`);
    const nearRiksintresse = riksBuffers.some((b) => turf.booleanIntersects(site.geometry, b));
    const stations = data.substations
      .map((station) => ({ station, distanceKm: distanceKm(site.centroid, station.coord) }))
      .sort((a, b) => a.distanceKm - b.distanceKm || a.station.id.localeCompare(b.station.id));
    out.set(site.id, {
      blocking,
      nearRiksintresse,
      stations,
      nearestQuarry: nearest(site, suppliers),
      nearestReceiver: nearest(site, receivers),
      ground: grounds.get(site.id)!,
    });
  }
  staticCache.set(data, out);
  return out;
}

// ---------------------------------------------------------------------------
// Rankning
// ---------------------------------------------------------------------------
function exclusionReasons(site: CandidateSite, st: SiteStatic, req: Requirements): string[] {
  const reasons: string[] = [...st.blocking];
  if (site.areaHa < req.minAreaHa) reasons.push(`För liten yta: ${fmt(site.areaHa)} ha < ${fmt(req.minAreaHa)} ha`);
  if (req.maxAreaHa !== undefined && site.areaHa > req.maxAreaHa) reasons.push(`För stor yta: ${fmt(site.areaHa)} ha > ${fmt(req.maxAreaHa)} ha`);
  if (!st.stations.some((s) => s.distanceKm <= req.maxDistanceToSubstationKm)) {
    reasons.push(`Ingen station inom ${req.maxDistanceToSubstationKm} km (närmaste ${fmt(st.stations[0]?.distanceKm ?? Infinity)} km)`);
  }
  if (!req.acceptedPlanStatus.includes(site.planStatus)) reasons.push(`Planstatus "${PLAN_STATUS_LABELS[site.planStatus]}" ej accepterad`);
  if (req.preferredElAreas.length > 0 && !req.preferredElAreas.includes(site.elArea)) reasons.push(`Ligger i ${site.elArea}, utanför valda elområden`);
  if (req.preferredRegions.length > 0) {
    const county = countyOfMunicipality(site.municipality);
    if (!req.preferredRegions.includes(site.municipality) && !(county && req.preferredRegions.includes(county))) {
      reasons.push(`Ligger i ${county ?? site.municipality}, utanför valda regioner`);
    }
  }
  if (req.needsRail && site.distanceToRailKm > RAIL_REQUIRED_KM) reasons.push(`Järnväg krävs men närmaste spår är ${fmt(site.distanceToRailKm)} km bort`);
  return reasons;
}

function fmt(v: number) {
  return (Math.round(v * 10) / 10).toString().replace('.', ',');
}

export interface RankOptions {
  prices: UnitPrices;
  topN?: number;
}

/** Filter → delpoäng → viktning → topp N (SPEC §9). Deterministisk. */
export function rankSites(data: MockDataset, req: Requirements, { prices, topN = TOP_N }: RankOptions): RankingResult {
  const statics = siteStatics(data);
  const weights = WEIGHTS[req.facilityType];
  const excluded: ExcludedSite[] = [];

  type Candidate = Omit<ScoredSite, 'subScores' | 'total' | 'rank' | 'reasons' | 'warnings'> & {
    scores: Omit<SubScores, 'ground'>;
  };
  const candidates: Candidate[] = [];

  for (const site of data.sites) {
    const st = statics.get(site.id)!;
    const reasons = exclusionReasons(site, st, req);
    if (reasons.length > 0) {
      excluded.push({ site, reasons });
      continue;
    }
    const inRange = st.stations.filter((s) => s.distanceKm <= req.maxDistanceToSubstationKm);
    const evals = inRange.map((s) => evaluateStation(s.station, s.distanceKm, req));
    const bestStation = [...evals].sort((a, b) => b.powerScore - a.powerScore || a.distanceKm - b.distanceKm)[0];
    const nearbyStations = st.stations.slice(0, 3).map((s) => evaluateStation(s.station, s.distanceKm, req));

    const g = st.ground;
    const fnd = recommendFoundation({
      soilType: g.soilType,
      depthToRockM: g.depthToRockM,
      loadClass: req.loadClass,
      groundwaterLevelM: g.groundwaterLevelM,
      confidence: g.confidence,
      facilityType: req.facilityType,
    });
    const { earthworks, foundationCostMSEK } = computeEarthworks({
      areaHa: site.areaHa,
      soilType: g.soilType,
      depthToRockM: g.depthToRockM,
      groundwaterLevelM: g.groundwaterLevelM,
      minElevM: g.terrain.minElevM,
      maxElevM: g.terrain.maxElevM,
      confidence: g.confidence,
      facilityType: req.facilityType,
      loadClass: req.loadClass,
      foundation: fnd,
      quarryDistanceKm: st.nearestQuarry?.distanceKm ?? 30,
      receiverDistanceKm: st.nearestReceiver?.distanceKm ?? 30,
      prices,
    });

    candidates.push({
      site,
      bestStation,
      nearbyStations,
      ground: g,
      earthworks,
      foundation: { ...fnd, costMSEK: foundationCostMSEK },
      nearestQuarry: st.nearestQuarry,
      nearestReceiver: st.nearestReceiver,
      budgetExceeded: req.maxEarthworksBudgetMSEK !== undefined && req.maxEarthworksBudgetMSEK < earthworks.totalMSEK.p50,
      scores: {
        power: bestStation.powerScore,
        timeToPower: timeToPowerScore(bestStation.yearToPower, req.targetConnectionYear),
        planning: planningScore(site.planStatus, st.nearRiksintresse),
        logistics: logisticsScore(site, req),
      },
    });
  }

  // Markpoäng kräver percentilrank bland kvarvarande kandidater
  const costsPerHa = candidates.map((c) => c.earthworks.costPerHaMSEK);
  const scored: ScoredSite[] = candidates.map((c) => {
    let ground = 100 * (1 - percentileRank(c.earthworks.costPerHaMSEK, costsPerHa));
    if (c.foundation.method === 'palning_lang' || (c.foundation.method === 'palning' && req.loadClass === 'tung')) ground -= 15;
    if (c.ground.confidence === 'low' && req.groundRiskTolerance === 'lag') ground -= 10;
    if (c.budgetExceeded) ground = 0;
    ground = clamp(ground, 0, 100);

    const subScores: SubScores = { ...c.scores, ground };
    const total = (Object.keys(weights) as ScoreKey[]).reduce((s, k) => s + weights[k] * subScores[k], 0);
    const { scores: _scores, ...rest } = c;
    return { ...rest, subScores, total: Math.round(total * 10) / 10, rank: 0, reasons: [], warnings: [] };
  });

  const quartile = [...costsPerHa].sort((a, b) => a - b)[Math.floor(costsPerHa.length * 0.75)] ?? Infinity;
  scored.sort((a, b) => b.total - a.total || a.site.id.localeCompare(b.site.id));
  scored.forEach((s, i) => {
    s.rank = i + 1;
    s.reasons = buildReasons(s, req, weights, s.earthworks.costPerHaMSEK >= quartile);
    s.warnings = buildWarnings(s, req);
  });

  return { top: scored.slice(0, topN), others: scored.slice(topN), excluded };
}

