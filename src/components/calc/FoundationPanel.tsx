import { fmtMSEK } from '../../lib/format';
import type { ScoredSite } from '../../types';

export function FoundationPanel({ s }: { s: ScoredSite }) {
  const f = s.foundation;
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Rekommenderad metod (regel {f.rule})</div>
        <div className="mt-0.5 font-semibold text-teal-950">{f.label}</div>
        <div className="mt-1 text-xs text-teal-900">
          Grundläggningskostnad: {fmtMSEK(f.costMSEK.p10)}–{fmtMSEK(f.costMSEK.p90)} MSEK (P50 {fmtMSEK(f.costMSEK.p50)})
        </div>
      </div>
      <div>
        <div className="label">Motivering</div>
        <p className="text-xs text-slate-700">{f.rationale}</p>
      </div>
      <div>
        <div className="label">Alternativ</div>
        {f.alternatives.length ? (
          <ul className="list-disc pl-4 text-xs text-slate-700">{f.alternatives.map((a) => <li key={a}>{a}</li>)}</ul>
        ) : <p className="text-xs text-slate-500">–</p>}
      </div>
      <div>
        <div className="label">Riskflaggor</div>
        {f.riskFlags.length ? (
          <ul className="space-y-1 text-xs">
            {f.riskFlags.map((r) => <li key={r} className="rounded bg-amber-50 px-2 py-1 text-amber-900">⚠ {r}</li>)}
          </ul>
        ) : <p className="text-xs text-slate-500">Inga särskilda riskflaggor.</p>}
      </div>
      <div>
        <div className="label">Krav på fortsatt utredning och tillägg</div>
        <ul className="space-y-1 text-xs">
          {f.additions.map((a) => <li key={a} className="rounded bg-slate-100 px-2 py-1">➕ {a}</li>)}
          <li className="rounded bg-slate-100 px-2 py-1">🔎 Geoteknisk undersökning rekommenderas alltid före investeringsbeslut (ingår i kalkylen).</li>
        </ul>
      </div>
    </div>
  );
}
