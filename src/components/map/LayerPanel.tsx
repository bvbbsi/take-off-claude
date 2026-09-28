import { useState } from 'react';
import { useAppStore, type LayerId } from '../../store/useAppStore';
import type { RankingResult } from '../../types';

const LAYERS: { id: LayerId; label: string; swatch: JSX.Element }[] = [
  { id: 'top', label: 'Rekommenderade (topp 10)', swatch: <span className="h-3 w-3 rounded-full rounded-bl-none bg-teal-700" /> },
  { id: 'others', label: 'Övriga kandidater', swatch: <span className="h-2.5 w-2.5 rounded-full border border-slate-600 bg-slate-400" /> },
  { id: 'excluded', label: 'Uteslutna platser', swatch: <span className="flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">✕</span> },
  { id: 'substations', label: 'Stationer', swatch: <span className="h-3 w-3 rounded-full border border-slate-900 bg-green-600" /> },
  { id: 'soils', label: 'Jordarter', swatch: <span className="h-3 w-3 rounded-sm bg-gradient-to-br from-lime-500 via-sky-400 to-yellow-300" /> },
  { id: 'wells', label: 'Brunnar', swatch: <span className="h-2 w-2 rounded-full bg-sky-500" /> },
  { id: 'quarries', label: 'Täkter/mottagningar', swatch: <span className="text-[10px]">⛰</span> },
  { id: 'restrictions', label: 'Restriktioner', swatch: <span className="h-3 w-3 border border-dashed border-green-700 bg-green-100" /> },
  { id: 'planning', label: 'Planområden', swatch: <span className="h-3 w-3 bg-violet-400/60" /> },
  { id: 'elAreas', label: 'Elområden', swatch: <span className="h-0 w-3 border-t border-dashed border-slate-700" /> },
];

export function LayerPanel({ ranking }: { ranking: RankingResult | null }) {
  const layers = useAppStore((s) => s.layers);
  const toggle = useAppStore((s) => s.toggleLayer);
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);

  const counts: Partial<Record<LayerId, number>> = ranking
    ? { top: ranking.top.length, others: ranking.others.length, excluded: ranking.excluded.length }
    : {};

  return (
    <div className="absolute left-2 top-2 z-10 w-52 rounded-lg border border-slate-200 bg-white/95 text-xs shadow-md backdrop-blur">
      <button className="flex w-full items-center justify-between px-2.5 py-1.5 font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>🗺 Kartlager</span>
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="space-y-0.5 border-t border-slate-100 px-2 py-1.5">
          {LAYERS.map((l) => (
            <li key={l.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50">
                <input type="checkbox" className="accent-teal-700" checked={layers[l.id]} onChange={() => toggle(l.id)} />
                <span className="flex w-3 justify-center">{l.swatch}</span>
                <span className="flex-1">{l.label}</span>
                {counts[l.id] !== undefined && <span className="text-slate-400">{counts[l.id]}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
