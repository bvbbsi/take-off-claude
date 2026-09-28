import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { RankingResult } from '../../types';
import { SiteCard } from './SiteCard';

export function ResultList({ ranking }: { ranking: RankingResult | null }) {
  const [showExcluded, setShowExcluded] = useState(false);
  const searchId = useAppStore((s) => s.searchId);
  const ref = useRef<HTMLDivElement>(null);

  // Scrolla till resultaten efter varje sökning
  useEffect(() => {
    if (searchId > 0) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [searchId]);

  return <div ref={ref} className="scroll-mt-2"><ResultBody ranking={ranking} showExcluded={showExcluded} setShowExcluded={setShowExcluded} /></div>;
}

function ResultBody({ ranking, showExcluded, setShowExcluded }: { ranking: RankingResult | null; showExcluded: boolean; setShowExcluded: (v: boolean) => void }) {
  const selectedId = useAppStore((s) => s.selectedSiteId);
  const selectSite = useAppStore((s) => s.selectSite);
  const showExcludedOnMap = useAppStore((s) => s.layers.excluded);
  const toggleLayer = useAppStore((s) => s.toggleLayer);

  if (!ranking) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
        Beskriv behovet eller svara på frågorna och klicka <b>Sök platser</b> för att få tio rekommendationer.
      </div>
    );
  }

  if (ranking.top.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-semibold">Inga platser uppfyller kraven.</p>
        <p className="mt-1">Alla {ranking.excluded.length} platser uteslöts. Prova att sänka minsta yta, öka max avstånd till station eller välja fler elområden.</p>
        <button className="mt-2 text-teal-700 hover:underline" onClick={() => setShowExcluded(true)}>Visa uteslutna platser</button>
        {showExcluded && <ExcludedList ranking={ranking} />}
      </div>
    );
  }

  return (
    <section aria-label="Resultat" className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Topp {ranking.top.length}</h2>
        <span className="text-[11px] text-slate-500">
          {ranking.top.length + ranking.others.length} kvar · {ranking.excluded.length} uteslutna
        </span>
      </div>
      {ranking.top.length < 10 && (
        <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Endast {ranking.top.length} platser uppfyller kraven.</p>
      )}
      <ol className="space-y-2">
        {ranking.top.map((s) => (
          <SiteCard key={s.site.id} s={s} selected={selectedId === s.site.id} onSelect={() => selectSite(s.site.id)} />
        ))}
      </ol>
      <div className="flex flex-wrap gap-3 pt-1 text-xs">
        <button className="text-teal-700 hover:underline" onClick={() => setShowExcluded(!showExcluded)}>
          {showExcluded ? 'Dölj' : 'Visa'} uteslutna platser ({ranking.excluded.length})
        </button>
        <label className="flex items-center gap-1 text-slate-600">
          <input type="checkbox" className="accent-teal-700" checked={showExcludedOnMap} onChange={() => toggleLayer('excluded')} />
          på kartan
        </label>
      </div>
      {showExcluded && <ExcludedList ranking={ranking} />}
    </section>
  );
}

function ExcludedList({ ranking }: { ranking: RankingResult }) {
  return (
    <ul className="mt-2 space-y-1">
      {ranking.excluded.map((e) => (
        <li key={e.site.id} className="rounded border border-red-100 bg-red-50/50 px-2 py-1 text-[11px]">
          <div className="font-medium text-slate-800">✕ {e.site.name} <span className="font-normal text-slate-500">({e.site.municipality}, {e.site.elArea})</span></div>
          <div className="text-red-800">Utesluten, orsak: {e.reasons.join('; ')}</div>
        </li>
      ))}
    </ul>
  );
}
