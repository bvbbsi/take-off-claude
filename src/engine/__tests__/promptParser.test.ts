import { describe, expect, it } from 'vitest';
import { parsePrompt } from '../promptParser';

const p = (t: string) => parsePrompt(t, { baseYear: 2026 });

describe('promptParser (regelbaserad)', () => {
  it('tolkar acceptansprompten', () => {
    const r = p('Datacenter 80 MW, minst 20 ha, norra Sverige, anslutning 2029');
    expect(r.requirements).toMatchObject({
      facilityType: 'datacenter', powerMW: 80, minAreaHa: 20, preferredElAreas: ['SE1', 'SE2'], targetConnectionYear: 2029,
    });
    expect(r.filledFields).toEqual(expect.arrayContaining(['facilityType', 'powerMW', 'minAreaHa', 'preferredElAreas', 'targetConnectionYear']));
  });

  it('BESS med "inom 2 år" och ytan 3 ha', () => {
    const r = p('Var kan jag ansluta 50 MW batterilager inom 2 år på 3 ha?');
    expect(r.requirements).toMatchObject({ facilityType: 'bess', powerMW: 50, targetConnectionYear: 2028, minAreaHa: 3 });
  });

  it('elområden, "före 2030" och stabil mark', () => {
    const r = p('Jag behöver 100 MW, 20 ha, helst SE1/SE2, stabil mark, anslutning före 2030.');
    expect(r.requirements.preferredElAreas).toEqual(['SE1', 'SE2']);
    expect(r.requirements.targetConnectionYear).toBe(2029);
    expect(r.requirements.groundRiskTolerance).toBe('lag');
    expect(r.requirements.powerMW).toBe(100);
  });

  it('industri med järnväg och tung last', () => {
    const r = p('Industri 10 MW, 15 ha, nära järnväg eller E-väg, tung last.');
    expect(r.requirements).toMatchObject({ facilityType: 'industri', powerMW: 10, minAreaHa: 15, needsRail: true, loadClass: 'tung' });
  });

  it('decimaler med komma och m² omräknas till ha', () => {
    const r = p('Logistiklager 2,5 MW på 45 000 m2');
    expect(r.requirements.facilityType).toBe('logistik');
    expect(r.requirements.powerMW).toBe(2.5);
    expect(r.requirements.minAreaHa).toBeCloseTo(4.5);
  });

  it('engelska: hydrogen, southern Sweden, heavy loads', () => {
    const r = p('Hydrogen electrolysis plant 200 MW in southern Sweden, heavy loads, by 2031');
    expect(r.requirements).toMatchObject({ facilityType: 'vatgas', powerMW: 200, preferredElAreas: ['SE4'], loadClass: 'tung', targetConnectionYear: 2031 });
  });

  it('Mälardalen ger SE3 och länslista', () => {
    const r = p('Serverhall 30 MW i Mälardalen med fiber och fjärrvärme');
    expect(r.requirements.facilityType).toBe('datacenter');
    expect(r.requirements.preferredElAreas).toEqual(['SE3']);
    expect(r.requirements.preferredRegions).toEqual(expect.arrayContaining(['Stockholms län', 'Uppsala län', 'Västmanlands län']));
    expect(r.requirements.needsFiber).toBe(true);
    expect(r.requirements.wantsDistrictHeating).toBe(true);
  });

  it('Skåne ger SE4 och Skåne län', () => {
    const r = p('Energilager 20 MW i Skåne');
    expect(r.requirements).toMatchObject({ facilityType: 'bess', preferredElAreas: ['SE4'], preferredRegions: ['Skåne län'] });
  });

  it('elområde 1–2 i ord och budget i MSEK', () => {
    const r = p('Fabrik i elområde 1-2, budget 40 MSEK för mark, detaljplan klar');
    expect(r.requirements.preferredElAreas).toEqual(['SE1', 'SE2']);
    expect(r.requirements.maxEarthworksBudgetMSEK).toBe(40);
    expect(r.requirements.acceptedPlanStatus).toEqual(['detaljplan_klar']);
  });

  it('intervall för yta ger min och max', () => {
    const r = p('Terminal 10-25 ha, lätt byggnad');
    expect(r.requirements).toMatchObject({ facilityType: 'logistik', minAreaHa: 10, maxAreaHa: 25, loadClass: 'latt' });
  });

  it('max yta och avstånd till station', () => {
    const r = p('BESS 60 MW, högst 4 ha, inom 10 km från station');
    expect(r.requirements).toMatchObject({ facilityType: 'bess', maxAreaHa: 4, maxDistanceToSubstationKm: 10 });
    expect(r.requirements.minAreaHa).toBeUndefined();
  });

  it('ortnamn ger län, spillvärme ger fjärrvärme', () => {
    const r = p('Datacenter nära Luleå, spillvärme, 1 GW');
    expect(r.requirements.preferredRegions).toEqual(['Norrbottens län']);
    expect(r.requirements.wantsDistrictHeating).toBe(true);
    expect(r.requirements.powerMW).toBe(1000);
  });

  it('batterilager tolkas inte som logistik', () => {
    expect(p('batterilager 5 MW').requirements.facilityType).toBe('bess');
  });

  it('otolkade delar returneras som hints', () => {
    const r = p('Datacenter 40 MW, blå fasad, 10 ha');
    expect(r.unparsedHints).toEqual(['blå fasad']);
    expect(r.filledFields).not.toContain('loadClass');
  });
});
