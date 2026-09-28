import { describe, expect, it } from 'vitest';
import { DEFAULT_UNIT_PRICES } from '../../config/unitPrices';
import { computeEarthworks, costRange, type EarthworksInput } from '../earthworks';

const input: EarthworksInput = {
  areaHa: 10,
  soilType: 'moran',
  depthToRockM: 1,
  groundwaterLevelM: 5,
  minElevM: 48,
  maxElevM: 52,
  confidence: 'medium',
  facilityType: 'logistik',
  loadClass: 'medel',
  foundation: { method: 'platta_mark', needsDewatering: false },
  quarryDistanceKm: 10,
  receiverDistanceKm: 5,
  prices: DEFAULT_UNIT_PRICES,
};

describe('massbalans (§10.2)', () => {
  const { earthworks: r } = computeEarthworks(input);

  it('känt indata ger kända volymer', () => {
    // A = 100 000 m², ΔH = 4 m → schakt = fyll = 100 000 m³; d_s = 2, andel berg = 0,5
    expect(r.volumes.avtackning).toBeCloseTo(30_000);
    expect(r.volumes.bergschakt).toBeCloseTo(50_000);
    expect(r.volumes.jordschakt).toBeCloseTo(50_000);
    expect(r.volumes.fyll).toBeCloseTo(100_000);
    // Återanvänt: berg 45 000 + morän 35 000 = 80 000 → inköp 20 000
    expect(r.volumes.inkopFyll).toBeCloseTo(20_000);
    // Bortforsling: morän 15 000 + bergspill 5 000
    expect(r.volumes.bortforsling).toBeCloseTo(20_000);
    expect(r.volumes.urgravning).toBe(0);
  });

  it('kända kostnadsrader', () => {
    const line = (post: string) => r.lines.find((l) => l.post.startsWith(post))!;
    expect(line('Etablering').costP50).toBeCloseTo(1_500_000 * 1.2);
    expect(line('Avtäckning').costP50).toBeCloseTo(30_000 * 70);
    expect(line('Bergschakt').costP50).toBeCloseTo(50_000 * 420);
    expect(line('Krossning').costP50).toBeCloseTo(45_000 * 2.7 * 55);
    expect(line('Inköpt fyll').costP50).toBeCloseTo(20_000 * 1.9 * 120);
    expect(line('Transport inköpt fyll (').costP50).toBeCloseTo(20_000 * 1.9 * 13 * 2.8);
    expect(line('Platta på mark').qty).toBeCloseTo(50_000);
  });

  it('P10/P90 följer osäkerheten', () => {
    const p50 = r.lines.reduce((s, l) => s + l.costP50, 0) / 1e6;
    expect(r.totalMSEK.p50).toBeCloseTo(p50);
    expect(r.totalMSEK.p10).toBeCloseTo(p50 * 0.75);
    expect(r.totalMSEK.p90).toBeCloseTo(p50 * 1.375);
    expect(r.costPerHaMSEK).toBeCloseTo(p50 / 10);
    expect(costRange(100, 'low')).toEqual({ p10: 60, p50: 100, p90: 160 });
    expect(costRange(100, 'high').p90).toBeCloseTo(122.5);
  });

  it('djupt berg ger ingen bergschakt och lera körs bort', () => {
    const { earthworks } = computeEarthworks({ ...input, soilType: 'lera', depthToRockM: 20 });
    expect(earthworks.volumes.bergschakt).toBe(0);
    expect(earthworks.volumes.inkopFyll).toBeCloseTo(100_000);
    expect(earthworks.volumes.bortforsling).toBeCloseTo(100_000);
    expect(earthworks.lines.some((l) => l.post === 'Mottagningsavgift lera/torv')).toBe(true);
  });

  it('pålning räknar antal pålar och pållängd', () => {
    const { earthworks, foundationCostMSEK } = computeEarthworks({
      ...input, soilType: 'lera', depthToRockM: 9, loadClass: 'tung', foundation: { method: 'palning', needsDewatering: false },
    });
    // Byggyta 50 000 m² / 2,5² = 8 000 pålar × 10 m
    const piles = earthworks.lines.find((l) => l.post.startsWith('Betongpålar'))!;
    expect(piles.qty).toBe(80_000);
    expect(foundationCostMSEK.p50).toBeGreaterThan((80_000 * 1_100 + 400_000) / 1e6);
  });

  it('urgrävning lägger till volym under byggnaden', () => {
    const { earthworks } = computeEarthworks({
      ...input, soilType: 'lera', depthToRockM: 2, foundation: { method: 'urgravning', needsDewatering: false },
    });
    expect(earthworks.volumes.urgravning).toBeCloseTo(50_000 * 2);
  });

  it('ändrat enhetspris räknar om kalkylen', () => {
    const a = computeEarthworks(input).earthworks.totalMSEK.p50;
    const b = computeEarthworks({ ...input, prices: { ...DEFAULT_UNIT_PRICES, bergschakt: 840 } }).earthworks.totalMSEK.p50;
    expect(b - a).toBeCloseTo((50_000 * 420) / 1e6);
  });
});
