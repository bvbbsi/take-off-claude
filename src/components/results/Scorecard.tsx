import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { SCORE_KEYS, SCORE_LABELS, WEIGHTS } from '../../config/weights';
import { fmt0, scoreColor } from '../../lib/format';
import type { FacilityType, ScoredSite } from '../../types';

export function Scorecard({ s, facilityType }: { s: ScoredSite; facilityType: FacilityType }) {
  const w = WEIGHTS[facilityType];
  const data = SCORE_KEYS.map((k) => ({ key: SCORE_LABELS[k], value: Math.round(s.subScores[k]) }));
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="58%" margin={{ top: 8, right: 40, bottom: 8, left: 40 }}>
            <PolarGrid />
            <PolarAngleAxis dataKey="key" tick={{ fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#0f766e" fill="#14b8a6" fillOpacity={0.35} />
            <Tooltip formatter={(v: number) => [`${v} / 100`, 'Delpoäng']} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <table className="tbl self-center">
        <thead>
          <tr><th>Delpoäng</th><th className="text-right">Poäng</th><th className="text-right">Vikt</th></tr>
        </thead>
        <tbody>
          {SCORE_KEYS.map((k) => (
            <tr key={k}>
              <td>{SCORE_LABELS[k]}</td>
              <td className="text-right font-semibold" style={{ color: scoreColor(s.subScores[k]) }}>{fmt0(s.subScores[k])}</td>
              <td className="text-right text-slate-500">{Math.round(w[k] * 100)} %</td>
            </tr>
          ))}
          <tr>
            <td className="font-semibold">Total</td>
            <td className="text-right text-base font-bold" style={{ color: scoreColor(s.total) }}>{fmt0(s.total)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
