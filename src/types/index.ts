// Domäntyper enligt SPEC §5. Alla lager bär `source` och `confidence` så att
// riktiga källor kan ersätta mock-data utan att UI:t behöver ändras.
import type { Polygon } from 'geojson';

export type DataSource =
  | 'MOCK'
  | 'SGU_JORDARTER' | 'SGU_JORDDJUP' | 'SGU_BRUNNSARKIVET' | 'SGU_BALLAST' | 'SGU_GRUNDVATTEN'
  | 'LM_HOJDMODELL' | 'LM_FASTIGHET'
  | 'SVK_KAPACITETSKARTA' | 'REGIONNAT' | 'LOKALNAT' | 'NATUTVECKLINGSPLAN'
  | 'KOMMUN_OP' | 'PLAN_DETALJPLAN' | 'NATURVARDSVERKET' | 'MANUAL';

export type Confidence = 'low' | 'medium' | 'high';
export type ElArea = 'SE1' | 'SE2' | 'SE3' | 'SE4';
export type LngLat = [number, number];

export interface Meta {
  source: DataSource;
  confidence: Confidence;
  updated: string;
}

// --- Elnät ---
export interface PlannedUpgrade {
  year: number;
  addedMW: number;
  description: string;
}

export interface Substation extends Meta {
  id: string;
  name: string;
  coord: LngLat;
  voltageKv: 400 | 220 | 130 | 70 | 40 | 20;
  gridLevel: 'transmission' | 'region' | 'lokal';
  operator: string;
  elArea: ElArea;
  capacityWithdrawalMW: number;
  queuedMW: number;
  plannedUpgrades: PlannedUpgrade[];
  status: 'green' | 'amber' | 'red';
}

// --- Markförhållanden ---
export type SoilType = 'berg' | 'moran' | 'sand_grus' | 'silt' | 'lera' | 'torv_gyttja' | 'fyllning';

export interface SoilPolygon extends Meta {
  id: string;
  geometry: Polygon;
  soilType: SoilType;
  soilDepthRangeM: [number, number];
}

export interface Well extends Meta {
  id: string;
  coord: LngLat;
  depthToRockM: number;
  totalDepthM: number;
  groundwaterLevelM?: number;
}

export interface TerrainCell extends Meta {
  siteId: string;
  minElevM: number;
  maxElevM: number;
  meanElevM: number;
  meanSlopePct: number;
}

// --- Massor ---
export interface Quarry extends Meta {
  id: string;
  name: string;
  coord: LngLat;
  type: 'bergtakt' | 'grustakt' | 'mottagning' | 'kombinerad';
  acceptsMasses: boolean;
  rockQuality: 'hog' | 'medel' | 'lag';
}

// --- Plan och restriktioner ---
export type PlanningKind =
  | 'detaljplan_industri' | 'detaljplan_verksamhet' | 'op_utredningsomrade'
  | 'riksintresse' | 'natura2000' | 'strandskydd' | 'naturreservat';

export interface PlanningArea extends Meta {
  id: string;
  geometry: Polygon;
  kind: PlanningKind;
  blocking: boolean;
  note?: string;
}

// --- Kandidatplatser ---
export type PlanStatus = 'detaljplan_klar' | 'planarbete_pagar' | 'op_utpekad' | 'oplanerad';

export interface CandidateSite extends Meta {
  id: string;
  name: string;
  municipality: string;
  elArea: ElArea;
  geometry: Polygon;
  centroid: LngLat;
  areaHa: number;
  ownership: 'kommunal' | 'privat' | 'statlig' | 'okand';
  planStatus: PlanStatus;
  distanceToRailKm: number;
  distanceToMajorRoadKm: number;
  districtHeatingNearby: boolean;
  fiberNearby: boolean;
}

// --- Krav ---
export type FacilityType = 'datacenter' | 'bess' | 'industri' | 'logistik' | 'vatgas' | 'ovrigt';
export type LoadClass = 'latt' | 'medel' | 'tung';
export type RiskTolerance = 'lag' | 'medel' | 'hog';

export interface Requirements {
  facilityType: FacilityType;
  powerMW: number;
  minAreaHa: number;
  maxAreaHa?: number;
  targetConnectionYear: number;
  preferredElAreas: ElArea[];
  preferredRegions: string[];
  maxDistanceToSubstationKm: number;
  groundRiskTolerance: RiskTolerance;
  maxEarthworksBudgetMSEK?: number;
  loadClass: LoadClass;
  acceptedPlanStatus: PlanStatus[];
  needsRail?: boolean;
  wantsDistrictHeating?: boolean;
  needsFiber?: boolean;
  _filledFields: (keyof Requirements)[];
}

export type RequirementField = Exclude<keyof Requirements, '_filledFields'>;

// --- Prompttolkning (§8.1) ---
export interface ParseResult {
  requirements: Partial<Requirements>;
  filledFields: (keyof Requirements)[];
  unparsedHints: string[];
}

export interface PromptParser {
  parse(text: string): Promise<ParseResult>;
}

// --- Kalkyl (§10.5) ---
export interface CostRange {
  p10: number;
  p50: number;
  p90: number;
}

export interface EarthworksLine {
  post: string;
  qty: number;
  unit: string;
  unitPrice: number;
  costP50: number;
  group: 'mark' | 'massor' | 'grundlaggning' | 'ovrigt';
}

export interface EarthworksResult {
  volumes: {
    avtackning: number;
    jordschakt: number;
    bergschakt: number;
    fyll: number;
    inkopFyll: number;
    bortforsling: number;
    urgravning: number;
  };
  lines: EarthworksLine[];
  totalMSEK: CostRange;
  costPerHaMSEK: number;
  assumptions: string[];
  confidence: Confidence;
}

// --- Grundläggning (§11) ---
export type FoundationMethod =
  | 'platta_berg' | 'platta_mark' | 'platta_forstarkt' | 'urgravning'
  | 'palning' | 'palning_lang' | 'kc_pelare' | 'urgravning_organisk';

export interface FoundationResult {
  method: FoundationMethod;
  rule: number;
  label: string;
  alternatives: string[];
  rationale: string;
  riskFlags: string[];
  additions: string[];
  needsDewatering: boolean;
  costMSEK: CostRange;
}

// --- Markmodell (§10.1) ---
export interface GroundModel {
  siteId: string;
  soilType: SoilType;
  soilDepthRangeM: [number, number];
  depthToRockM: number;
  depthUncertaintyM: number;
  wellCount: number;
  meanWellDistanceKm: number | null;
  groundwaterLevelM: number;
  groundwaterConfidence: Confidence;
  depthConfidence: Confidence;
  terrain: TerrainCell;
  confidence: Confidence;
  sources: { label: string; source: DataSource; confidence: Confidence; value: string }[];
}

// --- Rankning (§9) ---
export type ScoreKey = 'power' | 'timeToPower' | 'ground' | 'planning' | 'logistics';
export type SubScores = Record<ScoreKey, number>;
export type Weights = Record<ScoreKey, number>;

export interface StationEval {
  station: Substation;
  distanceKm: number;
  availableAtTargetMW: number;
  ratioToday: number;
  ratioAtTarget: number;
  yearToPower: number;
  powerScore: number;
}

export interface ScoredSite {
  site: CandidateSite;
  subScores: SubScores;
  total: number;
  rank: number;
  bestStation: StationEval;
  nearbyStations: StationEval[];
  ground: GroundModel;
  earthworks: EarthworksResult;
  foundation: FoundationResult;
  nearestQuarry: { quarry: Quarry; distanceKm: number } | null;
  nearestReceiver: { quarry: Quarry; distanceKm: number } | null;
  reasons: string[];
  warnings: string[];
  budgetExceeded: boolean;
}

export interface ExcludedSite {
  site: CandidateSite;
  reasons: string[];
}

export interface RankingResult {
  top: ScoredSite[];
  others: ScoredSite[];
  excluded: ExcludedSite[];
}

export interface MockDataset {
  sites: CandidateSite[];
  substations: Substation[];
  wells: Well[];
  soils: SoilPolygon[];
  terrain: TerrainCell[];
  quarries: Quarry[];
  planning: PlanningArea[];
}
