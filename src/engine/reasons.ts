import { SCORE_LABELS } from '../config/weights';
import type { Requirements, ScoredSite, ScoreKey, Weights } from '../types';
import { SOIL_LABELS } from './groundModel';
import { CURRENT_YEAR, PLAN_STATUS_LABELS } from './requirements';

const f1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const f0 = (v: number) => Math.round(v).toLocaleString('sv-SE');

/** Deterministisk text per delpoäng (§9.4). */
export function reasonFor(key: ScoreKey, s: ScoredSite, req: Requirements, costInUpperQuartile: boolean): string {
  const b = s.bestStation;
  const g = s.ground;
  switch (key) {
    case 'power': {
      const head = `${b.station.name} (${f1(b.distanceKm)} km) har ${f0(b.station.capacityWithdrawalMW)} MW ledig kapacitet`;
      if (b.ratioToday >= 1) return `${head} – räcker för behovet redan idag.`;
      if (b.ratioAtTarget >= 1) return `${head} – räcker för ${f0(req.powerMW)} MW efter planerad uppgradering.`;
      return `${head} och ${f0(b.station.queuedMW)} MW i kö – räcker inte för ${f0(req.powerMW)} MW till ${req.targetConnectionYear}.`;
    }
    case 'timeToPower':
      if (b.yearToPower <= CURRENT_YEAR) return `Effekt bedöms finnas tillgänglig redan idag (${b.station.status === 'green' ? 'grön' : b.station.status === 'amber' ? 'gul' : 'röd'} station).`;
      if (b.yearToPower <= req.targetConnectionYear) return `Effekt bedöms tillgänglig ${b.yearToPower}, före målåret ${req.targetConnectionYear}.`;
      return `Effekt bedöms tillgänglig först ${b.yearToPower >= 2035 ? '2035 eller senare' : b.yearToPower}, efter målåret ${req.targetConnectionYear}.`;
    case 'ground': {
      const lo = Math.max(0, g.depthToRockM - g.depthUncertaintyM);
      const hi = g.depthToRockM + g.depthUncertaintyM;
      const wells = g.wellCount >= 3 ? `${g.wellCount} brunnar inom 2 km` : 'få brunnar – modellerat';
      if (s.foundation.method === 'palning' || s.foundation.method === 'palning_lang') {
        return `Risk: ${f0(lo)}–${f0(hi)} m ${SOIL_LABELS[g.soilType].toLowerCase()}, pålning krävs.${costInUpperQuartile ? ' Markkostnad i övre kvartilen.' : ''}`;
      }
      if (g.soilType === 'lera' || g.soilType === 'silt' || g.soilType === 'torv_gyttja') {
        return `${SOIL_LABELS[g.soilType]} med berg på ca ${f0(lo)}–${f0(hi)} m (${wells}) – ${s.foundation.label.toLowerCase()}.`;
      }
      return `${SOIL_LABELS[g.soilType]} med berg på ca ${f0(lo)}–${f0(hi)} m djup (${wells}) – gynnsamt för grundläggning.`;
    }
    case 'planning':
      return `${PLAN_STATUS_LABELS[s.site.planStatus]}${s.subScores.planning < { detaljplan_klar: 100, planarbete_pagar: 70, op_utpekad: 50, oplanerad: 25 }[s.site.planStatus] ? ', nära riksintresse' : ''}${s.site.planStatus === 'detaljplan_klar' ? ' – kort ledtid till bygglov.' : s.site.planStatus === 'oplanerad' ? ' – planprocess krävs (typiskt 1,5–3 år).' : '.'}`;
    case 'logistics': {
      const parts = [`väg ${f1(s.site.distanceToMajorRoadKm)} km`, `järnväg ${f1(s.site.distanceToRailKm)} km`];
      if (s.site.fiberNearby) parts.push('fiber finns');
      if (s.site.districtHeatingNearby) parts.push('fjärrvärmenät för restvärme');
      return `Logistik: ${parts.join(', ')}.`;
    }
  }
}

/** De två starkaste skälen (högst delpoäng, vid lika: högst vikt). */
export function buildReasons(s: ScoredSite, req: Requirements, weights: Weights, costInUpperQuartile: boolean): string[] {
  const keys = (Object.keys(s.subScores) as ScoreKey[]).sort(
    (a, b) => s.subScores[b] - s.subScores[a] || weights[b] - weights[a],
  );
  // "Effekt finns redan idag" säger samma sak som effektmotiveringen – undvik dubbletter.
  const distinct = s.bestStation.ratioToday >= 1 ? keys.filter((k) => k !== 'timeToPower') : keys;
  return distinct.map((k) => reasonFor(k, s, req, costInUpperQuartile));
}

export function strongestReasons(s: ScoredSite, n = 2): string[] {
  return s.reasons.slice(0, n);
}

export function weakestScore(s: ScoredSite): { key: ScoreKey; label: string; value: number } {
  const key = (Object.keys(s.subScores) as ScoreKey[]).sort((a, b) => s.subScores[a] - s.subScores[b])[0];
  return { key, label: SCORE_LABELS[key], value: s.subScores[key] };
}

/** Kritiska varningar som visas med ikon på resultatkortet. */
export function buildWarnings(s: ScoredSite, req: Requirements): string[] {
  const w: string[] = [];
  const g = s.ground;
  if ((g.soilType === 'lera' || g.soilType === 'silt') && g.depthToRockM > 10) w.push(`Djup lera (ca ${f0(g.depthToRockM)} m till berg)`);
  if (g.soilType === 'torv_gyttja') w.push('Torv/gyttja inom tomten');
  const b = s.bestStation;
  if (b.station.status === 'red') {
    const up = b.station.plannedUpgrades[0];
    w.push(up ? `Röd station, uppgradering först ${up.year}` : 'Röd station utan planerad uppgradering');
  } else if (b.yearToPower > req.targetConnectionYear) {
    w.push(`Effekt först ${b.yearToPower >= 2035 ? '2035+' : b.yearToPower}`);
  }
  if (s.site.planStatus === 'oplanerad') w.push('Oplanerad mark');
  if (s.budgetExceeded) w.push(`Markkostnad P50 överstiger budget (${f1(req.maxEarthworksBudgetMSEK ?? 0)} MSEK)`);
  if (g.confidence === 'low') w.push('Låg tillförlitlighet i markunderlaget');
  return w;
}
