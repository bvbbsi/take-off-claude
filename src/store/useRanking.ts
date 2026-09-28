import { useMemo } from 'react';
import { dataset } from '../data';
import { rankSites } from '../engine/scoring';
import type { RankingResult, ScoredSite } from '../types';
import { useAppStore } from './useAppStore';

/** Rankningen räknas om direkt när krav eller enhetspriser ändras (efter första sökningen). */
export function useRanking(): RankingResult | null {
  const requirements = useAppStore((s) => s.requirements);
  const unitPrices = useAppStore((s) => s.unitPrices);
  const searched = useAppStore((s) => s.searched);
  return useMemo(
    () => (searched ? rankSites(dataset, requirements, { prices: unitPrices }) : null),
    [searched, requirements, unitPrices],
  );
}

export function useSelectedSite(ranking: RankingResult | null): ScoredSite | null {
  const id = useAppStore((s) => s.selectedSiteId);
  return useMemo(() => {
    if (!ranking || !id) return null;
    return ranking.top.find((s) => s.site.id === id) ?? ranking.others.find((s) => s.site.id === id) ?? null;
  }, [ranking, id]);
}
