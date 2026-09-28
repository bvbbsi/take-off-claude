import { SCORE_KEYS, SCORE_LABELS } from '../../config/weights';
import { FOUNDATION_SHORT } from '../../engine/foundation';
import { fmt0, fmtMSEK, scoreColor } from '../../lib/format';
import type { ScoredSite } from '../../types';
import { Tooltip } from '../common/Tooltip';

export function MiniBars({ s }: { s: ScoredSite }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {SCORE_KEYS.map((k) => (
        <div key={k} title={`${SCORE_LABELS[k]}: ${fmt0(s.subScores[k])}`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full" style={{ width: `${s.subScores[k]}%`, background: scoreColor(s.subScores[k]) }} />
          </div>
          <div className="mt-0.5 truncate text-[9px] text-slate-500">{SCORE_LABELS[k]}</div>
        </div>
      ))}
    </div>
  );
}

export function SiteCard({ s, selected, onSelect }: { s: ScoredSite; selected: boolean; onSelect: () => void }) {
  const b = s.bestStation;
  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={selected}
        className={`card w-full p-2.5 text-left transition hover:border-teal-400 hover:shadow-sm ${selected ? 'border-teal-600 ring-1 ring-teal-600' : ''}`}
      >
        <div className="flex items-start gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: scoreColor(s.total) }}>
            {s.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold">{s.site.name}</span>
              {s.warnings.length > 0 && (
                <Tooltip text={s.warnings.join(' • ')}>
                  <span className="text-amber-600" aria-label={`Varningar: ${s.warnings.join(', ')}`}>⚠</span>
                </Tooltip>
              )}
            </div>
            <div className="text-[11px] text-slate-500">{s.site.municipality} · {s.site.elArea} · {fmt0(s.site.areaHa)} ha</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold leading-none" style={{ color: scoreColor(s.total) }}>{fmt0(s.total)}</div>
            <div className="text-[9px] text-slate-400">av 100</div>
          </div>
        </div>
        <div className="mt-2"><MiniBars s={s} /></div>
        <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
          <div className="rounded bg-slate-50 px-1.5 py-1">
            <div className="text-slate-500">Ledig effekt</div>
            <div className="font-semibold">{fmt0(b.station.capacityWithdrawalMW)} MW</div>
          </div>
          <div className="rounded bg-slate-50 px-1.5 py-1">
            <div className="text-slate-500">Mark P50</div>
            <div className={`font-semibold ${s.budgetExceeded ? 'text-red-700' : ''}`}>{fmtMSEK(s.earthworks.totalMSEK.p50)} MSEK</div>
          </div>
          <div className="rounded bg-slate-50 px-1.5 py-1">
            <div className="text-slate-500">Grundläggning</div>
            <div className="truncate font-semibold">{FOUNDATION_SHORT[s.foundation.method]}</div>
          </div>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
          <b className="text-slate-700">Varför:</b> {s.reasons.slice(0, 2).join(' ')}
        </p>
      </button>
    </li>
  );
}
