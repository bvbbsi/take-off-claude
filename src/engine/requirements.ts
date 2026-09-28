import type { ElArea, FacilityType, LoadClass, PlanStatus, RequirementField, Requirements } from '../types';

export const CURRENT_YEAR = 2026;

export const ALL_PLAN_STATUSES: PlanStatus[] = ['detaljplan_klar', 'planarbete_pagar', 'op_utpekad', 'oplanerad'];
export const ALL_EL_AREAS: ElArea[] = ['SE1', 'SE2', 'SE3', 'SE4'];

export const FACILITY_LABELS: Record<FacilityType, string> = {
  datacenter: 'Datacenter',
  bess: 'Batterilager (BESS)',
  industri: 'Industri',
  logistik: 'Logistik',
  vatgas: 'Vätgas/elektrolys',
  ovrigt: 'Övrigt',
};

export const FACILITY_ICONS: Record<FacilityType, string> = {
  datacenter: '🖥️',
  bess: '🔋',
  industri: '🏭',
  logistik: '📦',
  vatgas: '💧',
  ovrigt: '⚙️',
};

export const LOAD_LABELS: Record<LoadClass, string> = { latt: 'Lätt', medel: 'Medel', tung: 'Tung' };

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  detaljplan_klar: 'Detaljplan klar',
  planarbete_pagar: 'Planarbete pågår',
  op_utpekad: 'Utpekad i ÖP',
  oplanerad: 'Oplanerad',
};

export const RISK_LABELS = { lag: 'Låg', medel: 'Medel', hog: 'Hög' } as const;

/** Andel av tomten som antas bebyggas (§10.2). */
export const BUILDING_SHARE: Record<FacilityType, number> = {
  datacenter: 0.35,
  bess: 0.4,
  industri: 0.45,
  logistik: 0.5,
  vatgas: 0.4,
  ovrigt: 0.4,
};

type Defaults = Omit<Requirements, '_filledFields' | 'facilityType'>;

const BASE: Defaults = {
  powerMW: 20,
  minAreaHa: 5,
  targetConnectionYear: CURRENT_YEAR + 3,
  preferredElAreas: [],
  preferredRegions: [],
  maxDistanceToSubstationKm: 30,
  groundRiskTolerance: 'medel',
  loadClass: 'medel',
  acceptedPlanStatus: [...ALL_PLAN_STATUSES],
};

/** Standardvärden per anläggningstyp (§5). */
export const FACILITY_DEFAULTS: Record<FacilityType, Defaults> = {
  datacenter: { ...BASE, powerMW: 50, minAreaHa: 10, loadClass: 'tung', wantsDistrictHeating: true, needsFiber: true },
  bess: { ...BASE, powerMW: 50, minAreaHa: 1, loadClass: 'medel' },
  industri: { ...BASE, powerMW: 20, minAreaHa: 10, loadClass: 'tung' },
  logistik: { ...BASE, powerMW: 5, minAreaHa: 10, loadClass: 'medel' },
  vatgas: { ...BASE, powerMW: 100, minAreaHa: 10, loadClass: 'medel' },
  ovrigt: { ...BASE },
};

export function defaultRequirements(facilityType: FacilityType = 'datacenter'): Requirements {
  const d = FACILITY_DEFAULTS[facilityType];
  return {
    facilityType,
    ...d,
    preferredElAreas: [...d.preferredElAreas],
    preferredRegions: [...d.preferredRegions],
    acceptedPlanStatus: [...d.acceptedPlanStatus],
    _filledFields: [],
  };
}

/**
 * Bygger ett komplett kravobjekt: standardvärden för anläggningstypen, överlagrat med
 * de fält som användaren/prompten angett.
 */
export function buildRequirements(partial: Partial<Requirements>, filled: (keyof Requirements)[] = []): Requirements {
  const base = defaultRequirements(partial.facilityType ?? 'datacenter');
  const merged: Requirements = { ...base };
  for (const [k, v] of Object.entries(partial) as [keyof Requirements, unknown][]) {
    if (v === undefined || k === '_filledFields') continue;
    (merged as unknown as Record<string, unknown>)[k] = v;
  }
  merged._filledFields = Array.from(new Set([...filled, ...(partial._filledFields ?? [])]));
  return merged;
}

/** Byter anläggningstyp och uppdaterar de fält användaren inte själv angett till nya standardvärden. */
export function changeFacilityType(req: Requirements, facilityType: FacilityType): Requirements {
  const fresh = defaultRequirements(facilityType);
  const next: Requirements = { ...fresh, facilityType };
  for (const f of req._filledFields) {
    if (f === 'facilityType' || f === '_filledFields') continue;
    (next as unknown as Record<string, unknown>)[f] = req[f];
  }
  next._filledFields = Array.from(new Set([...req._filledFields, 'facilityType' as const]));
  return next;
}

/** Fält som frågas i formuläret och som räknas som "saknade" om de inte angetts. */
export const QUESTION_FIELDS: RequirementField[] = [
  'facilityType', 'powerMW', 'minAreaHa', 'targetConnectionYear', 'preferredElAreas',
  'loadClass', 'groundRiskTolerance', 'acceptedPlanStatus',
];
