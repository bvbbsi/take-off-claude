import { describe, expect, it } from 'vitest';
import { DEFAULT_UNIT_PRICES } from '../../config/unitPrices';
import { dataset } from '../../data';
import type { Substation } from '../../types';
import { parsePrompt } from '../promptParser';
import { buildRequirements, defaultRequirements } from '../requirements';
import { evaluateStation, logisticsScore, percentileRank, planningScore, rankSites, timeToPowerScore } from '../scoring';

const opts = { prices: DEFAULT_UNIT_PRICES };

const station: Substation = {
  id: 's', name: 'Station Test 130 kV (mock)', coord: [0, 0], voltageKv: 130, gridLevel: 'region', operator: 'x', elArea: 'SE2',
  capacityWithdrawalMW: 40, queuedMW: 20, plannedUpgrades: [{ year: 2028, addedMW: 50, description: '' }],
  status: 'amber', source: 'MOCK', confidence: 'medium', updated: '',
};

describe('delpoäng (§9.2)', () => {
  it('effekt: tillgängligt vid målår, avstånd och spänningsbonus', () => {
    // 40 + 50 − 10 = 80 MW vid 2029, kvot 1,33 → 88,9; −2 för 4 km; +5 (130 kV ≥ 10–50 MW)
    const e = evaluateStation(station, 4, { powerMW: 60, targetConnectionYear: 2029 });
    expect(e.availableAtTargetMW).toBe(80);
    expect(e.powerScore).toBeCloseTo((80 / 60 / 1.5) * 100 - 2 + 5);
    // 40 − 10 = 30 < 60 idag → uppgradering 2028 ger 80 ≥ 60
    expect(e.yearToPower).toBe(2028);
  });
  it('effekt saknas → 2035', () => {
    expect(evaluateStation(station, 1, { powerMW: 500, targetConnectionYear: 2029 }).yearToPower).toBe(2035);
  });
  it('tid till effekt', () => {
    expect(timeToPowerScore(2028, 2029)).toBe(100);
    expect(timeToPowerScore(2031, 2029)).toBe(50);
    expect(timeToPowerScore(2035, 2029)).toBe(0);
  });
  it('plan och logistik', () => {
    expect(planningScore('detaljplan_klar', false)).toBe(100);
    expect(planningScore('oplanerad', true)).toBe(5);
    const site = dataset.sites[0];
    const req = defaultRequirements('datacenter');
    const s = logisticsScore({ ...site, distanceToMajorRoadKm: 1, distanceToRailKm: 1, fiberNearby: true, districtHeatingNearby: true }, req);
    expect(s).toBe(100);
  });
  it('percentilrank', () => {
    expect(percentileRank(1, [1, 2, 3])).toBe(0);
    expect(percentileRank(3, [1, 2, 3])).toBe(1);
  });
});

describe('rankning', () => {
  it('är deterministisk', () => {
    const req = defaultRequirements('bess');
    const a = rankSites(dataset, req, opts);
    const b = rankSites(dataset, { ...req }, opts);
    expect(a.top.map((s) => [s.site.id, s.total])).toEqual(b.top.map((s) => [s.site.id, s.total]));
    expect(a.excluded.map((e) => e.site.id)).toEqual(b.excluded.map((e) => e.site.id));
  });

  it('acceptansprompten ger 10 resultat i SE1/SE2', () => {
    const parsed = parsePrompt('Datacenter 80 MW, minst 20 ha, norra Sverige, anslutning 2029');
    const req = buildRequirements(parsed.requirements, parsed.filledFields);
    const r = rankSites(dataset, req, opts);
    expect(r.top).toHaveLength(10);
    for (const s of r.top) {
      expect(['SE1', 'SE2']).toContain(s.site.elArea);
      expect(s.site.areaHa).toBeGreaterThanOrEqual(20);
      expect(s.reasons.length).toBeGreaterThanOrEqual(2);
    }
    // sorterat på total poäng
    const totals = r.top.map((s) => s.total);
    expect([...totals].sort((x, y) => y - x)).toEqual(totals);
  });

  it('formulär med standardvärden för alla typer ger 10 resultat', () => {
    for (const t of ['datacenter', 'bess', 'industri', 'logistik', 'vatgas', 'ovrigt'] as const) {
      expect(rankSites(dataset, defaultRequirements(t), opts).top).toHaveLength(10);
    }
  });

  it('blockerade platser utesluts med orsak', () => {
    const r = rankSites(dataset, defaultRequirements('bess'), opts);
    const blocked = r.excluded.filter((e) => e.reasons.some((x) => x.startsWith('Överlappar')));
    expect(blocked.length).toBeGreaterThanOrEqual(5);
    expect([...r.top, ...r.others].some((s) => blocked.some((b) => b.site.id === s.site.id))).toBe(false);
  });

  it('budget under P50 ger markpoäng 0 och varning', () => {
    const req = { ...defaultRequirements('bess'), maxEarthworksBudgetMSEK: 0.1 };
    const r = rankSites(dataset, req, opts);
    expect(r.top.every((s) => s.subScores.ground === 0 && s.budgetExceeded)).toBe(true);
  });

  it('ändrat enhetspris påverkar kalkylen', () => {
    const req = defaultRequirements('logistik');
    const a = rankSites(dataset, req, opts);
    const b = rankSites(dataset, req, { prices: { ...DEFAULT_UNIT_PRICES, etablering: 3_000_000 } });
    const id = a.top[0].site.id;
    const find = (r: typeof a) => [...r.top, ...r.others].find((s) => s.site.id === id)!;
    expect(find(b).earthworks.totalMSEK.p50).toBeGreaterThan(find(a).earthworks.totalMSEK.p50);
  });
});
