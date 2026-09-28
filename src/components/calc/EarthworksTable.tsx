import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt0, fmtMSEK, fmtQty } from '../../lib/format';
import { useAppStore } from '../../store/useAppStore';
import type { EarthworksLine, ScoredSite } from '../../types';
import { ConfidenceBadge } from '../common/SourceBox';

const GROUP_LABELS: Record<EarthworksLine['group'], string> = {
  mark: 'Markarbeten',
  massor: 'Massor & transport',
  grundlaggning: 'Grundläggning',
  ovrigt: 'Övrigt',
};

export function MassBalanceTable({ s }: { s: ScoredSite }) {
  const v = s.earthworks.volumes;
  const rows: [string, number, string][] = [
    ['Avtäckning matjord', v.avtackning, 'm³'],
    ['Jordschakt', v.jordschakt, 'm³'],
    ['Bergschakt', v.bergschakt, 'm³ fast'],
    ['Fyllnadsbehov', v.fyll, 'm³'],
    ['Inköpt fyll', v.inkopFyll, 'm³'],
    ['Bortforsling', v.bortforsling, 'm³'],
    ['Urgrävning under byggnad', v.urgravning, 'm³'],
  ];
  return (
    <table className="tbl">
      <thead><tr><th>Massbalans</th><th className="text-right">Volym</th><th>Enhet</th></tr></thead>
      <tbody>
        {rows.map(([k, val, u]) => (
          <tr key={k}><td>{k}</td><td className="text-right tabular-nums">{fmt0(val)}</td><td className="text-slate-500">{u}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function CostTable({ s }: { s: ScoredSite }) {
  const e = s.earthworks;
  const setPriceEditorOpen = useAppStore((st) => st.setPriceEditorOpen);
  const ratio = { p10: e.totalMSEK.p10 / e.totalMSEK.p50, p90: e.totalMSEK.p90 / e.totalMSEK.p50 };
  const groups = (Object.keys(GROUP_LABELS) as EarthworksLine['group'][])
    .map((g) => ({ g, label: GROUP_LABELS[g], p50: e.lines.filter((l) => l.group === g).reduce((a, l) => a + l.costP50, 0) / 1e6 }))
    .filter((x) => x.p50 > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {(['p10', 'p50', 'p90'] as const).map((k) => (
          <div key={k} className={`rounded-md p-1.5 ${k === 'p50' ? 'bg-teal-50 ring-1 ring-teal-200' : 'bg-slate-50'}`}>
            <div className="text-[10px] font-semibold uppercase text-slate-500">{k.toUpperCase()}</div>
            <div className="text-sm font-bold">{fmtMSEK(e.totalMSEK[k])}</div>
            <div className="text-[10px] text-slate-500">MSEK</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
        <span>{fmtMSEK(e.costPerHaMSEK)} MSEK/ha (P50)</span>·<span>Osäkerhet</span><ConfidenceBadge c={e.confidence} />
        <button className="ml-auto text-teal-700 hover:underline" onClick={() => setPriceEditorOpen(true)}>✎ Justera enhetspriser</button>
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={groups} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} unit=" M" />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={105} />
            <Tooltip formatter={(v: number) => [`${fmtMSEK(v)} MSEK`, 'P50']} />
            <Bar dataKey="p50" fill="#0f766e" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="-mx-1 overflow-x-auto">
        <table className="tbl min-w-[520px]">
          <thead>
            <tr>
              <th>Post</th><th className="text-right">Mängd</th><th>Enhet</th><th className="text-right">À-pris</th>
              <th className="text-right">P10</th><th className="text-right">P50</th><th className="text-right">P90</th>
            </tr>
          </thead>
          <tbody>
            {e.lines.map((l) => (
              <tr key={l.post}>
                <td>{l.post}</td>
                <td className="text-right tabular-nums">{fmtQty(l.qty)}</td>
                <td className="text-slate-500">{l.unit}</td>
                <td className="text-right tabular-nums">{fmtQty(l.unitPrice)}</td>
                <td className="text-right tabular-nums text-slate-500">{fmtMSEK((l.costP50 * ratio.p10) / 1e6)}</td>
                <td className="text-right font-medium tabular-nums">{fmtMSEK(l.costP50 / 1e6)}</td>
                <td className="text-right tabular-nums text-slate-500">{fmtMSEK((l.costP50 * ratio.p90) / 1e6)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={4}>Summa (MSEK)</td>
              <td className="text-right">{fmtMSEK(e.totalMSEK.p10)}</td>
              <td className="text-right">{fmtMSEK(e.totalMSEK.p50)}</td>
              <td className="text-right">{fmtMSEK(e.totalMSEK.p90)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <details className="text-[11px] text-slate-600">
        <summary className="cursor-pointer font-medium">Antaganden ({e.assumptions.length})</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {e.assumptions.map((a) => <li key={a}>{a}</li>)}
          <li>P10 = P50 × (1 − u), P90 = P50 × (1 + 1,5u); u från svagaste källan (låg 0,40 / medel 0,25 / hög 0,15).</li>
        </ul>
      </details>
    </div>
  );
}
