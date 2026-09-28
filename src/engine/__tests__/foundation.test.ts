import { describe, expect, it } from 'vitest';
import { recommendFoundation, TEXT_DEWATERING, TEXT_GEOTECH, TEXT_SENSITIVE, type FoundationInput } from '../foundation';

const base: FoundationInput = {
  soilType: 'moran', depthToRockM: 4, loadClass: 'medel', groundwaterLevelM: 5, confidence: 'high', facilityType: 'logistik',
};
const rec = (o: Partial<FoundationInput>) => recommendFoundation({ ...base, ...o });

describe('grundläggningsregler (§11)', () => {
  it('regel 1: berg ≤ 1 m → platta på berg', () => {
    const r = rec({ soilType: 'lera', depthToRockM: 0.8 });
    expect(r.rule).toBe(1);
    expect(r.method).toBe('platta_berg');
    expect(r.alternatives).toContain('Platta på packad bergfyll');
  });
  it('regel 2: morän, medel last → platta på mark', () => {
    const r = rec({ soilType: 'moran', loadClass: 'medel' });
    expect([r.rule, r.method]).toEqual([2, 'platta_mark']);
  });
  it('regel 2: sand/grus, lätt last → platta på mark', () => {
    expect(rec({ soilType: 'sand_grus', loadClass: 'latt' }).method).toBe('platta_mark');
  });
  it('regel 3: morän, tung last → förstärkt platta', () => {
    const r = rec({ soilType: 'moran', loadClass: 'tung' });
    expect([r.rule, r.method]).toEqual([3, 'platta_forstarkt']);
    expect(r.riskFlags).toContain('Kontrollera blockighet i morän');
  });
  it('regel 4: lera ≤ 3 m → urgrävning', () => {
    const r = rec({ soilType: 'lera', depthToRockM: 2.5 });
    expect([r.rule, r.method]).toEqual([4, 'urgravning']);
  });
  it('regel 5: lera 3–15 m, tung last → pålning', () => {
    const r = rec({ soilType: 'lera', depthToRockM: 10, loadClass: 'tung' });
    expect([r.rule, r.method]).toEqual([5, 'palning']);
  });
  it('regel 5: silt 3–15 m, medel last → pålning', () => {
    expect(rec({ soilType: 'silt', depthToRockM: 6, loadClass: 'medel' }).rule).toBe(5);
  });
  it('regel 6: lera 3–15 m, lätt last → KC-pelare', () => {
    const r = rec({ soilType: 'lera', depthToRockM: 8, loadClass: 'latt' });
    expect([r.rule, r.method]).toEqual([6, 'kc_pelare']);
  });
  it('regel 7: lera > 15 m → långa pålar', () => {
    const r = rec({ soilType: 'lera', depthToRockM: 22 });
    expect([r.rule, r.method]).toEqual([7, 'palning_lang']);
  });
  it('regel 8: torv ≤ 2,5 m → urgrävning organiskt', () => {
    const r = rec({ soilType: 'torv_gyttja', depthToRockM: 2 });
    expect([r.rule, r.method]).toEqual([8, 'urgravning_organisk']);
  });
  it('regel 9: torv > 2,5 m → pålning, alternativ uteslut plats', () => {
    const r = rec({ soilType: 'torv_gyttja', depthToRockM: 4 });
    expect([r.rule, r.method]).toEqual([9, 'palning']);
    expect(r.alternatives).toContain('Uteslut plats');
    expect(r.riskFlags).toContain('Starkt avrådande vid tung last');
  });

  it('tillägg: grundvatten < 1,5 m under schaktbotten → länshållning', () => {
    const r = rec({ groundwaterLevelM: 1.2 });
    expect(r.additions).toContain(TEXT_DEWATERING);
    expect(r.needsDewatering).toBe(true);
    expect(rec({ groundwaterLevelM: 3 }).needsDewatering).toBe(false);
  });
  it('tillägg: urgrävning till 3 m med grundvatten 4 m → länshållning', () => {
    expect(rec({ soilType: 'lera', depthToRockM: 3, groundwaterLevelM: 4 }).needsDewatering).toBe(true);
  });
  it('tillägg: låg confidence → geoteknisk undersökning krävs', () => {
    expect(rec({ confidence: 'low' }).additions).toContain(TEXT_GEOTECH);
    expect(rec({ confidence: 'medium' }).additions).not.toContain(TEXT_GEOTECH);
  });
  it('tillägg: datacenter på lera (regel 4–7) → sättningskänslig', () => {
    expect(rec({ soilType: 'lera', depthToRockM: 10, facilityType: 'datacenter' }).additions).toContain(TEXT_SENSITIVE);
    expect(rec({ soilType: 'lera', depthToRockM: 10, facilityType: 'industri', loadClass: 'tung' }).additions).toContain(TEXT_SENSITIVE);
    expect(rec({ soilType: 'lera', depthToRockM: 10, facilityType: 'logistik' }).additions).not.toContain(TEXT_SENSITIVE);
    expect(rec({ soilType: 'moran', facilityType: 'datacenter' }).additions).not.toContain(TEXT_SENSITIVE);
  });
});
