import type { UnitPrices } from '../config/unitPrices';
import type {
  Confidence, CostRange, EarthworksLine, EarthworksResult, FacilityType, FoundationResult, LoadClass, SoilType,
} from '../types';
import { BUILDING_SHARE } from './requirements';
import { excavationDepthM } from './foundation';

// Konstanter enligt SPEC §10.2–10.4
export const TOPSOIL_DEPTH_M = 0.3;
export const DENSITY_SOIL = 1.9; // t/m³
export const DENSITY_ROCK = 2.7; // t/m³ fast
export const ROCK_BULKING = 1.6; // lös-faktor för transport
export const ROCK_REUSE = 0.9;
export const FRICTION_REUSE = 0.7;
export const ROAD_FACTOR = 1.3;
export const PILE_SPACING_M: Record<LoadClass, number> = { tung: 2.5, medel: 3.5, latt: 3.5 };
export const KC_SPACING_M = 1.5;
export const KC_YARD_SHARE = 0.15; // hårdgjorda ytor utanför byggnad
export const KC_MAX_LENGTH_M = 15;
export const UNCERTAINTY: Record<Confidence, number> = { low: 0.4, medium: 0.25, high: 0.15 };

export interface EarthworksInput {
  areaHa: number;
  soilType: SoilType;
  depthToRockM: number;
  groundwaterLevelM: number;
  minElevM: number;
  maxElevM: number;
  confidence: Confidence;
  facilityType: FacilityType;
  loadClass: LoadClass;
  foundation: Pick<FoundationResult, 'method' | 'needsDewatering'>;
  /** Fågelvägsavstånd till närmaste täkt för inköp av fyll (km). */
  quarryDistanceKm: number;
  /** Fågelvägsavstånd till närmaste mottagning av massor (km). */
  receiverDistanceKm: number;
  prices: UnitPrices;
}

export interface EarthworksOutput {
  earthworks: EarthworksResult;
  foundationCostMSEK: CostRange;
}

export function costRange(p50: number, confidence: Confidence): CostRange {
  const u = UNCERTAINTY[confidence];
  return { p10: p50 * (1 - u), p50, p90: p50 * (1 + 1.5 * u) };
}

const isFriction = (s: SoilType) => s === 'moran' || s === 'sand_grus';
const isCohesiveOrOrganic = (s: SoilType) => s === 'lera' || s === 'silt' || s === 'torv_gyttja';

/**
 * Förenklad platåmodell för massbalans och kostnad (SPEC §10.2–10.4).
 * Alla volymer i m³ (berg i m³ fast), vikter i ton, kostnader i SEK.
 */
export function computeEarthworks(input: EarthworksInput): EarthworksOutput {
  const { areaHa, soilType, depthToRockM, prices: P, foundation } = input;
  const A = areaHa * 10_000;
  const dH = Math.max(0, input.maxElevM - input.minElevM);
  const buildingArea = A * BUILDING_SHARE[input.facilityType];

  // --- Massbalans ---
  const avtackning = A * TOPSOIL_DEPTH_M;
  const schakt = (A * dH) / 4;
  const fyllBehov = schakt;
  const ds = dH / 2;
  const andelBerg = ds > 0 && depthToRockM < ds ? (ds - depthToRockM) / ds : 0;
  const bergschakt = schakt * andelBerg;
  const jordschakt = schakt - bergschakt;

  const bergTillFyll = bergschakt * ROCK_REUSE;
  const jordTillFyll = isFriction(soilType) ? jordschakt * FRICTION_REUSE : 0;
  const tillgangligFyll = bergTillFyll + jordTillFyll;
  let inkopFyll = Math.max(0, fyllBehov - tillgangligFyll);
  const overskottFyll = Math.max(0, tillgangligFyll - fyllBehov);

  // Urgrävning under byggnaden (§10.2 tillägg)
  const urgravDepth = foundation.method === 'urgravning' || foundation.method === 'urgravning_organisk'
    ? excavationDepthM(foundation.method, depthToRockM) : 0;
  const urgravning = buildingArea * urgravDepth;
  inkopFyll += urgravning;

  // Bortforsling: ej återanvändbar jord, överskott av fyll, bergspill och urgrävda massor
  const jordEjAterbrukad = jordschakt - jordTillFyll;
  const bergSpill = bergschakt - bergTillFyll;
  const bortforslingJord = jordEjAterbrukad + urgravning; // m³ jord
  const bortforslingRen = overskottFyll + bergSpill; // m³ (fyll/berg)
  const bortforsling = bortforslingJord + bortforslingRen;

  const dirtyFee = isCohesiveOrOrganic(soilType) || soilType === 'fyllning';
  const tonJordBort = bortforslingJord * DENSITY_SOIL;
  const tonRenBort = bortforslingRen * DENSITY_SOIL;
  const tonInkop = inkopFyll * DENSITY_SOIL;
  const tonKross = bergTillFyll * DENSITY_ROCK;
  const inkopKm = input.quarryDistanceKm * ROAD_FACTOR;
  const bortKm = input.receiverDistanceKm * ROAD_FACTOR;

  const lines: EarthworksLine[] = [];
  const add = (post: string, qty: number, unit: string, unitPrice: number, group: EarthworksLine['group']) => {
    if (qty <= 0) return;
    lines.push({ post, qty, unit, unitPrice, costP50: qty * unitPrice, group });
  };

  // --- Markarbeten ---
  add('Etablering markarbeten (skalad)', 1 + areaHa / 50, 'st', P.etablering, 'mark');
  add('Avtäckning matjord', avtackning, 'm³', P.avtackning, 'mark');
  add('Jordschakt inkl. lastning', jordschakt + urgravning, 'm³', P.jordschakt, 'mark');
  add('Bergschakt (sprängning inkl. lastning)', bergschakt, 'm³ fast', P.bergschakt, 'mark');
  add('Krossning på plats', tonKross, 'ton', P.krossning, 'mark');
  add('Fyllning och packning', fyllBehov + urgravning, 'm³', P.fyllning, 'mark');

  // --- Massor och transport ---
  add('Inköpt fyllnadsmaterial', tonInkop, 'ton', P.inkopFyll, 'massor');
  add(`Transport inköpt fyll (${inkopKm.toFixed(1).replace('.', ',')} km)`, tonInkop * inkopKm, 'ton·km', P.transport, 'massor');
  add('Transport inköpt fyll, fast avgift', tonInkop, 'ton', P.transportFast, 'massor');
  const tonBort = tonJordBort + tonRenBort;
  add(`Transport bortforsling (${bortKm.toFixed(1).replace('.', ',')} km)`, tonBort * bortKm, 'ton·km', P.transport, 'massor');
  add('Transport bortforsling, fast avgift', tonBort, 'ton', P.transportFast, 'massor');
  if (dirtyFee) {
    add('Mottagningsavgift lera/torv', tonJordBort, 'ton', P.mottagningLera, 'massor');
    add('Mottagningsavgift rena massor', tonRenBort, 'ton', P.mottagningRen, 'massor');
  } else {
    add('Mottagningsavgift rena massor', tonJordBort + tonRenBort, 'ton', P.mottagningRen, 'massor');
  }

  // --- Grundläggning (§10.3) ---
  const assumptions: string[] = [
    `Tomten planas till en platå på medelhöjden; schakt ≈ fyll ≈ A × ΔH / 4 (ΔH = ${dH.toFixed(1).replace('.', ',')} m).`,
    `Avtäckning ${TOPSOIL_DEPTH_M.toString().replace('.', ',')} m matjord, läggs upp på tomten.`,
    `Bergschakt återanvänds som fyll till ${ROCK_REUSE * 100} %, friktionsjord till ${FRICTION_REUSE * 100} %. Lera, silt och torv körs bort.`,
    `Densitet jord ${DENSITY_SOIL.toString().replace('.', ',')} t/m³, berg ${DENSITY_ROCK.toString().replace('.', ',')} t/m³ fast (lös-faktor ${ROCK_BULKING.toString().replace('.', ',')} vid transport).`,
    `Transportavstånd = fågelväg × ${ROAD_FACTOR.toString().replace('.', ',')} (vägfaktor).`,
    `Byggyta ${Math.round(BUILDING_SHARE[input.facilityType] * 100)} % av tomten (${Math.round(buildingArea).toLocaleString('sv-SE')} m²).`,
  ];

  const m = foundation.method;
  if (m === 'platta_berg' || m === 'platta_forstarkt') {
    add('Förstärkt platta/plintar', buildingArea, 'm² byggyta', P.plattaForstarkt, 'grundlaggning');
  } else {
    add('Platta på mark (grundläggningsdel)', buildingArea, 'm² byggyta', P.plattaMark, 'grundlaggning');
  }
  if (m === 'palning' || m === 'palning_lang') {
    const spacing = PILE_SPACING_M[input.loadClass];
    const count = Math.ceil(buildingArea / spacing ** 2);
    const length = depthToRockM + 1;
    add(`Betongpålar (${count.toLocaleString('sv-SE')} st × ${length.toFixed(1).replace('.', ',')} m)`, count * length, 'lm', P.palar, 'grundlaggning');
    add('Pålning, etablering', 1, 'st', P.palningEtablering, 'grundlaggning');
    assumptions.push(`Pålavstånd ${spacing.toString().replace('.', ',')} × ${spacing.toString().replace('.', ',')} m, pållängd = djup till fast botten + 1 m. Pålad platta ingår.`);
  }
  if (m === 'kc_pelare') {
    const length = Math.min(depthToRockM, KC_MAX_LENGTH_M);
    add('KC-pelare under byggnad', Math.ceil(buildingArea / KC_SPACING_M ** 2) * length, 'lm', P.kcPelare, 'grundlaggning');
  }
  // KC-pelare för hårdgjorda ytor utanför byggnaden på lera/silt
  if ((soilType === 'lera' || soilType === 'silt') && depthToRockM > 3) {
    const yard = A * KC_YARD_SHARE;
    const length = Math.min(depthToRockM, KC_MAX_LENGTH_M);
    add('KC-pelare, ytor utanför byggnad', Math.ceil(yard / KC_SPACING_M ** 2) * length, 'lm', P.kcPelare, 'mark');
    assumptions.push(`KC-pelare c/c ${KC_SPACING_M.toString().replace('.', ',')} m under ${KC_YARD_SHARE * 100} % hårdgjorda ytor utanför byggnad.`);
  }
  // Länshållning: grundvatten nära schaktbotten, eller bergschakt med högt grundvatten
  const rockDewater = input.groundwaterLevelM < 1.5 && bergschakt > 0;
  if (foundation.needsDewatering || rockDewater) {
    const area = Math.max(foundation.needsDewatering ? buildingArea : 0, rockDewater ? A / 2 : 0);
    add('Länshållning/tätning', area, 'm² schaktyta', P.lanshallning, 'grundlaggning');
  }

  // --- Övrigt ---
  const complexity = isCohesiveOrOrganic(soilType) || input.confidence === 'low' ? 2 : 1;
  const geotech = Math.min(P.geoteknikMax, P.geoteknikMin + areaHa * 15_000 * complexity);
  add('Geoteknisk undersökning (rekommenderad)', 1, 'st', geotech, 'ovrigt');

  const totalP50 = lines.reduce((s, l) => s + l.costP50, 0);
  const foundationP50 = lines.filter((l) => l.group === 'grundlaggning').reduce((s, l) => s + l.costP50, 0);
  const toM = (r: CostRange): CostRange => ({ p10: r.p10 / 1e6, p50: r.p50 / 1e6, p90: r.p90 / 1e6 });
  const total = toM(costRange(totalP50, input.confidence));

  return {
    earthworks: {
      volumes: {
        avtackning,
        jordschakt,
        bergschakt,
        fyll: fyllBehov + urgravning,
        inkopFyll,
        bortforsling,
        urgravning,
      },
      lines,
      totalMSEK: total,
      costPerHaMSEK: areaHa > 0 ? total.p50 / areaHa : 0,
      assumptions,
      confidence: input.confidence,
    },
    foundationCostMSEK: toM(costRange(foundationP50, input.confidence)),
  };
}
