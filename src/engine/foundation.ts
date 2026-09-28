import type { Confidence, FacilityType, FoundationMethod, FoundationResult, LoadClass, SoilType } from '../types';
import { SOIL_LABELS } from './groundModel';

export interface FoundationInput {
  soilType: SoilType;
  depthToRockM: number;
  loadClass: LoadClass;
  groundwaterLevelM: number;
  confidence: Confidence;
  facilityType: FacilityType;
}

export const FOUNDATION_LABELS: Record<FoundationMethod, string> = {
  platta_berg: 'Platta/plintar direkt på berg (sprängbotten)',
  platta_mark: 'Platta på mark på packad friktionsfyll',
  platta_forstarkt: 'Platta på mark med förstärkning / plintar',
  urgravning: 'Urgrävning och återfyllning (massutskiftning) + platta på mark',
  palning: 'Pålning – spetsburna betongpålar till berg/fast botten',
  palning_lang: 'Pålning – långa pålar (spets- eller friktionsburna)',
  kc_pelare: 'KC-pelare + platta på mark',
  urgravning_organisk: 'Urgrävning av organiskt material + friktionsfyll',
};

export const FOUNDATION_SHORT: Record<FoundationMethod, string> = {
  platta_berg: 'Platta på berg',
  platta_mark: 'Platta på mark',
  platta_forstarkt: 'Förstärkt platta',
  urgravning: 'Urgrävning',
  palning: 'Pålning',
  palning_lang: 'Långa pålar',
  kc_pelare: 'KC-pelare',
  urgravning_organisk: 'Urgrävning (organiskt)',
};

export const TEXT_DEWATERING = 'Tillägg: länshållning/tätning';
export const TEXT_DEWATERING_FLAG = 'Grundvattensänkning kan kräva tillstånd (vattenverksamhet)';
export const TEXT_GEOTECH = 'Geoteknisk undersökning krävs innan beslut';
export const TEXT_SENSITIVE = 'Sättningskänslig verksamhet – pålad grundläggning rekommenderas även för golv';

/** Ungefärligt schaktdjup under markyta för respektive metod (för grundvattenkontroll). */
export function excavationDepthM(method: FoundationMethod, depthToRockM: number): number {
  switch (method) {
    case 'urgravning':
      return Math.min(depthToRockM, 3);
    case 'urgravning_organisk':
      return Math.min(depthToRockM, 2.5);
    case 'platta_berg':
      return Math.max(0.5, depthToRockM);
    default:
      return 0.5;
  }
}

const isFriction = (s: SoilType) => s === 'moran' || s === 'sand_grus' || s === 'berg';
const isCohesive = (s: SoilType) => s === 'lera' || s === 'silt' || s === 'fyllning';

/**
 * Väljer grundläggningsmetod enligt regeltabellen i SPEC §11.
 * Returnerar resultat utan kostnad – kostnaden beräknas i markkalkylen.
 */
export function recommendFoundation(input: FoundationInput): Omit<FoundationResult, 'costMSEK'> {
  const { soilType, depthToRockM: d, loadClass, groundwaterLevelM, confidence, facilityType } = input;
  const fmt = (v: number) => v.toFixed(1).replace('.', ',');
  const soilText = `${SOIL_LABELS[soilType]}, djup till berg ca ${fmt(d)} m, lastklass ${loadClass === 'latt' ? 'lätt' : loadClass}`;

  let rule: number;
  let method: FoundationMethod;
  let alternatives: string[];
  let riskFlags: string[];

  if (d <= 1) {
    rule = 1;
    method = 'platta_berg';
    alternatives = ['Platta på packad bergfyll'];
    riskFlags = ['Sprängning nära befintlig bebyggelse'];
  } else if (soilType === 'torv_gyttja') {
    if (d <= 2.5) {
      rule = 8;
      method = 'urgravning_organisk';
      alternatives = [];
      riskFlags = ['Deponikostnad'];
    } else {
      rule = 9;
      method = 'palning';
      alternatives = ['Uteslut plats'];
      riskFlags = ['Starkt avrådande vid tung last'];
    }
  } else if (isFriction(soilType)) {
    if (loadClass === 'tung') {
      rule = 3;
      method = 'platta_forstarkt';
      alternatives = ['Pålning om djupa lösa skikt påträffas'];
      riskFlags = ['Kontrollera blockighet i morän'];
    } else {
      rule = 2;
      method = 'platta_mark';
      alternatives = ['Plintar'];
      riskFlags = [];
    }
  } else if (isCohesive(soilType)) {
    if (d <= 3) {
      rule = 4;
      method = 'urgravning';
      alternatives = ['Plintar till fast botten'];
      riskFlags = ['Lermassor till mottagning'];
    } else if (d <= 15) {
      if (loadClass === 'latt') {
        rule = 6;
        method = 'kc_pelare';
        alternatives = ['Lättfyllning'];
        riskFlags = ['Långtidssättningar'];
      } else {
        rule = 5;
        method = 'palning';
        alternatives = ['KC-pelare + platta vid lätt last'];
        riskFlags = ['Sättningar i omgivande ytor', 'Negativ mantelfriktion'];
      }
    } else {
      rule = 7;
      method = 'palning_lang';
      alternatives = ['Friktionspålar + lättfyllning'];
      riskFlags = ['Hög kostnad', 'Stabilitet', 'Kräver detaljerad geoteknik'];
    }
  } else {
    // Okänd jordart – behandla försiktigt som friktionsjord
    rule = 2;
    method = 'platta_mark';
    alternatives = ['Plintar'];
    riskFlags = [];
  }

  if (soilType === 'fyllning' && rule >= 4 && rule <= 7) riskFlags.push('Heterogen fyllning – kontrollera föroreningar');

  const additions: string[] = [];
  const excavation = excavationDepthM(method, d);
  const needsDewatering = groundwaterLevelM - excavation < 1.5;
  if (needsDewatering) {
    additions.push(TEXT_DEWATERING);
    riskFlags.push(TEXT_DEWATERING_FLAG);
  }
  if (confidence === 'low') additions.push(TEXT_GEOTECH);
  const sensitive = facilityType === 'datacenter' || (facilityType === 'industri' && loadClass === 'tung');
  if (sensitive && rule >= 4 && rule <= 7) additions.push(TEXT_SENSITIVE);

  const rationale =
    `Regel ${rule}: ${soilText}. Grundvatten ca ${fmt(groundwaterLevelM)} m under markyta` +
    (needsDewatering ? ` (mindre än 1,5 m under schaktbotten på ca ${fmt(excavation)} m).` : '.') +
    ` Underlagets tillförlitlighet: ${confidence === 'low' ? 'låg' : confidence === 'medium' ? 'medel' : 'hög'}.`;

  return {
    method,
    rule,
    label: FOUNDATION_LABELS[method],
    alternatives,
    rationale,
    riskFlags,
    additions,
    needsDewatering,
  };
}
