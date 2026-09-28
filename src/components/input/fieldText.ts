import { PLAN_STATUS_LABELS, FACILITY_LABELS, LOAD_LABELS, RISK_LABELS, ALL_PLAN_STATUSES } from '../../engine/requirements';
import type { RequirementField, Requirements } from '../../types';

const f = (v: number) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(v);

/** Kort chip-text per kravfält, eller null om fältet inte ska visas som chip. */
export function chipText(field: RequirementField, r: Requirements): string | null {
  switch (field) {
    case 'facilityType': return FACILITY_LABELS[r.facilityType];
    case 'powerMW': return `${f(r.powerMW)} MW`;
    case 'minAreaHa': return `≥ ${f(r.minAreaHa)} ha`;
    case 'maxAreaHa': return r.maxAreaHa !== undefined ? `≤ ${f(r.maxAreaHa)} ha` : null;
    case 'targetConnectionYear': return `Anslutning ${r.targetConnectionYear}`;
    case 'preferredElAreas': return r.preferredElAreas.length ? r.preferredElAreas.join(', ') : 'Alla elområden';
    case 'preferredRegions': return r.preferredRegions.length ? r.preferredRegions.join(', ') : null;
    case 'maxDistanceToSubstationKm': return `Station ≤ ${f(r.maxDistanceToSubstationKm)} km`;
    case 'groundRiskTolerance': return `Markrisk: ${RISK_LABELS[r.groundRiskTolerance].toLowerCase()}`;
    case 'maxEarthworksBudgetMSEK': return r.maxEarthworksBudgetMSEK !== undefined ? `Budget mark ≤ ${f(r.maxEarthworksBudgetMSEK)} MSEK` : null;
    case 'loadClass': return `Last: ${LOAD_LABELS[r.loadClass].toLowerCase()}`;
    case 'acceptedPlanStatus':
      return r.acceptedPlanStatus.length === ALL_PLAN_STATUSES.length ? 'Alla planstatus' : r.acceptedPlanStatus.map((p) => PLAN_STATUS_LABELS[p]).join(', ');
    case 'needsRail': return r.needsRail ? 'Järnväg krävs' : null;
    case 'wantsDistrictHeating': return r.wantsDistrictHeating ? 'Fjärrvärme' : null;
    case 'needsFiber': return r.needsFiber ? 'Fiber' : null;
  }
}

export const CHIP_ORDER: RequirementField[] = [
  'facilityType', 'powerMW', 'minAreaHa', 'maxAreaHa', 'targetConnectionYear', 'preferredElAreas', 'preferredRegions',
  'loadClass', 'groundRiskTolerance', 'maxEarthworksBudgetMSEK', 'acceptedPlanStatus', 'maxDistanceToSubstationKm',
  'needsRail', 'wantsDistrictHeating', 'needsFiber',
];

/** Vilket formulärsteg ett fält hör till (för att hoppa dit från ett chip). */
export const FIELD_STEP: Record<RequirementField, number> = {
  facilityType: 0,
  powerMW: 1,
  minAreaHa: 2,
  maxAreaHa: 2,
  targetConnectionYear: 3,
  preferredElAreas: 4,
  preferredRegions: 4,
  loadClass: 5,
  groundRiskTolerance: 6,
  maxEarthworksBudgetMSEK: 6,
  acceptedPlanStatus: 7,
  maxDistanceToSubstationKm: 7,
  needsRail: 7,
  wantsDistrictHeating: 7,
  needsFiber: 7,
};
