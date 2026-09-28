import { dataset } from '../../data';
import { SOIL_LABELS } from '../../engine/groundModel';
import { PLAN_STATUS_LABELS } from '../../engine/requirements';
import { weakestScore } from '../../engine/reasons';
import { fmt0, fmt1 } from '../../lib/format';
import type { RankingResult } from '../../types';
import { PLANNING_KIND_LABELS, QUARRY_LABELS, STATUS_COLORS } from './mapStyle';

export interface PopupTarget {
  kind: 'top' | 'other' | 'excluded' | 'substation' | 'soil' | 'well' | 'quarry' | 'planning';
  id: string;
  coord: [number, number];
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3">
    <span className="text-slate-500">{k}</span>
    <span className="text-right font-medium">{v}</span>
  </div>
);

export function MapPopupContent({ target, ranking, onDetails }: { target: PopupTarget; ranking: RankingResult | null; onDetails: (id: string) => void }) {
  const { kind, id } = target;

  if (kind === 'top') {
    const s = ranking?.top.find((x) => x.site.id === id);
    if (!s) return null;
    return (
      <div className="space-y-1">
        <div className="font-semibold">#{s.rank} {s.site.name}</div>
        <Row k="Total poäng" v={`${fmt0(s.total)} / 100`} />
        <button className="btn-primary mt-1 w-full py-1 text-xs" onClick={() => onDetails(id)}>Visa detaljer</button>
      </div>
    );
  }

  if (kind === 'other') {
    const s = ranking?.others.find((x) => x.site.id === id);
    const site = dataset.sites.find((x) => x.id === id)!;
    if (!s) {
      return (
        <div className="space-y-1">
          <div className="font-semibold">{site.name}</div>
          <Row k="Kommun" v={site.municipality} />
          <Row k="Yta" v={`${fmt1(site.areaHa)} ha`} />
          <p className="text-slate-500">Gör en sökning för att se hur platsen rankas.</p>
        </div>
      );
    }
    const w = weakestScore(s);
    const tenth = ranking!.top[ranking!.top.length - 1];
    return (
      <div className="space-y-1">
        <div className="font-semibold">{s.site.name}</div>
        <Row k="Rang" v={`#${s.rank} (${fmt0(s.total)} p)`} />
        <p className="text-slate-600">
          Inte topp 10: {fmt1(tenth.total - s.total)} poäng under plats 10. Svagast på <b>{w.label.toLowerCase()}</b> ({fmt0(w.value)}/100).
        </p>
        <button className="btn-secondary mt-1 w-full py-1 text-xs" onClick={() => onDetails(id)}>Visa detaljer</button>
      </div>
    );
  }

  if (kind === 'excluded') {
    const e = ranking?.excluded.find((x) => x.site.id === id);
    if (!e) return null;
    return (
      <div className="space-y-1">
        <div className="font-semibold">{e.site.name}</div>
        <div className="font-semibold text-red-700">Utesluten, orsak:</div>
        <ul className="list-disc pl-4 text-slate-700">
          {e.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>
    );
  }

  if (kind === 'substation') {
    const s = dataset.substations.find((x) => x.id === id)!;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-semibold">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] }} />
          {s.name}
        </div>
        <Row k="Spänning" v={`${s.voltageKv} kV (${s.gridLevel})`} />
        <Row k="Ledig effekt" v={`${fmt0(s.capacityWithdrawalMW)} MW`} />
        <Row k="I kö" v={`${fmt0(s.queuedMW)} MW`} />
        <Row k="Elområde" v={s.elArea} />
        <div className="text-slate-500">Uppgraderingar:</div>
        {s.plannedUpgrades.length === 0 ? <div>–</div> : s.plannedUpgrades.map((u) => (
          <div key={u.year + u.description}>{u.year}: +{fmt0(u.addedMW)} MW – {u.description}</div>
        ))}
      </div>
    );
  }

  if (kind === 'soil') {
    const s = dataset.soils.find((x) => x.id === id)!;
    return (
      <div className="space-y-1">
        <div className="font-semibold">{SOIL_LABELS[s.soilType]}</div>
        <Row k="Jorddjup" v={`${fmt1(s.soilDepthRangeM[0])}–${fmt1(s.soilDepthRangeM[1])} m`} />
      </div>
    );
  }

  if (kind === 'well') {
    const w = dataset.wells.find((x) => x.id === id)!;
    return (
      <div className="space-y-1">
        <div className="font-semibold">Brunn {w.id}</div>
        <Row k="Djup till berg" v={`${fmt1(w.depthToRockM)} m`} />
        <Row k="Totaldjup" v={`${fmt0(w.totalDepthM)} m`} />
        <Row k="Grundvattennivå" v={w.groundwaterLevelM !== undefined ? `${fmt1(w.groundwaterLevelM)} m u. my` : 'saknas'} />
      </div>
    );
  }

  if (kind === 'quarry') {
    const q = dataset.quarries.find((x) => x.id === id)!;
    return (
      <div className="space-y-1">
        <div className="font-semibold">{q.name}</div>
        <Row k="Typ" v={QUARRY_LABELS[q.type]} />
        <Row k="Tar emot massor" v={q.acceptsMasses ? 'Ja' : 'Nej'} />
        <Row k="Bergkvalitet" v={{ hog: 'Hög', medel: 'Medel', lag: 'Låg' }[q.rockQuality]} />
      </div>
    );
  }

  const p = dataset.planning.find((x) => x.id === id)!;
  const site = p.kind.startsWith('detaljplan') || p.kind === 'op_utredningsomrade';
  return (
    <div className="space-y-1">
      <div className="font-semibold">{PLANNING_KIND_LABELS[p.kind]}</div>
      {site ? (
        <Row k="Planstatus" v={p.kind === 'op_utredningsomrade' ? PLAN_STATUS_LABELS.op_utpekad : PLAN_STATUS_LABELS.detaljplan_klar} />
      ) : (
        <Row k="Blockerande" v={p.blocking ? 'Ja – hårt stopp' : 'Nej'} />
      )}
      {p.note && <div className="text-slate-500">{p.note}</div>}
    </div>
  );
}
