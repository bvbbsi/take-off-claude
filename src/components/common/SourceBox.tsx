import { CONFIDENCE_CLASS, CONFIDENCE_LABEL } from '../../lib/format';
import type { Confidence, DataSource } from '../../types';

export interface SourceRow {
  label: string;
  value: string;
  source: DataSource;
  confidence: Confidence;
}

export function ConfidenceBadge({ c }: { c: Confidence }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CONFIDENCE_CLASS[c]}`}>{CONFIDENCE_LABEL[c]}</span>;
}

/** Källruta som avslutar varje flik (§7.4). */
export function SourceBox({ rows }: { rows: SourceRow[] }) {
  return (
    <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-2">
      <div className="label">Källor och tillförlitlighet</div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Värde</th>
            <th>Källa</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>
                <div className="font-medium">{r.label}</div>
                <div className="text-slate-500">{r.value}</div>
              </td>
              <td className="font-mono text-[10px]">{r.source}</td>
              <td>
                <ConfidenceBadge c={r.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
