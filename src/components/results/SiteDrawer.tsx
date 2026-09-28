import { FOUNDATION_SHORT } from '../../engine/foundation';
import { SOIL_LABELS } from '../../engine/groundModel';
import { PLAN_STATUS_LABELS, CURRENT_YEAR } from '../../engine/requirements';
import { fmt0, fmt1, fmtKm, fmtMSEK, scoreColor } from '../../lib/format';
import { useAppStore, type DetailTab } from '../../store/useAppStore';
import type { ScoredSite } from '../../types';
import { CostTable, MassBalanceTable } from '../calc/EarthworksTable';
import { FoundationPanel } from '../calc/FoundationPanel';
import { Disclaimer } from '../common/Disclaimer';
import { ConfidenceBadge, SourceBox, type SourceRow } from '../common/SourceBox';
import { STATUS_COLORS } from '../map/mapStyle';
import { Scorecard } from './Scorecard';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'oversikt', label: 'Översikt' },
  { id: 'effekt', label: 'Effekt' },
  { id: 'mark', label: 'Mark & kalkyl' },
  { id: 'grundlaggning', label: 'Grundläggning' },
];

const KV = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
  <div className="rounded-md bg-slate-50 px-2 py-1.5">
    <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
    <div className="text-sm font-semibold">{v}</div>
    {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
  </div>
);

function siteSources(s: ScoredSite): SourceRow[] {
  return [
    { label: 'Kandidatplats', value: `${s.site.name}, ${fmt1(s.site.areaHa)} ha`, source: s.site.source, confidence: s.site.confidence },
    { label: 'Planstatus', value: PLAN_STATUS_LABELS[s.site.planStatus], source: s.site.source, confidence: s.site.confidence },
  ];
}
function powerSources(s: ScoredSite): SourceRow[] {
  return s.nearbyStations.map((e) => ({
    label: e.station.name, value: `${fmt0(e.station.capacityWithdrawalMW)} MW ledig, ${fmt0(e.station.queuedMW)} MW kö`,
    source: e.station.source, confidence: e.station.confidence,
  }));
}
function groundSources(s: ScoredSite): SourceRow[] {
  const rows: SourceRow[] = s.ground.sources.map((x) => ({ label: x.label, value: x.value, source: x.source, confidence: x.confidence }));
  if (s.nearestQuarry) rows.push({ label: 'Närmaste täkt', value: `${s.nearestQuarry.quarry.name} (${fmtKm(s.nearestQuarry.distanceKm)})`, source: s.nearestQuarry.quarry.source, confidence: s.nearestQuarry.quarry.confidence });
  if (s.nearestReceiver) rows.push({ label: 'Närmaste mottagning', value: `${s.nearestReceiver.quarry.name} (${fmtKm(s.nearestReceiver.distanceKm)})`, source: s.nearestReceiver.quarry.source, confidence: s.nearestReceiver.quarry.confidence });
  rows.push({ label: 'Enhetspriser', value: 'Mock-priser, redigerbara', source: 'MANUAL', confidence: 'low' });
  return rows;
}

export function SiteDrawer({ s, onClose }: { s: ScoredSite; onClose: () => void }) {
  const tab = useAppStore((st) => st.detailTab);
  const setTab = useAppStore((st) => st.setDetailTab);
  const req = useAppStore((st) => st.requirements);
  const g = s.ground;

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="border-b border-slate-200 px-3 pb-0 pt-2.5">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: scoreColor(s.total) }}>{s.rank}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold leading-tight">{s.site.name}</h2>
            <div className="text-xs text-slate-500">{s.site.municipality} · {s.site.elArea} · {fmt1(s.site.areaHa)} ha · {PLAN_STATUS_LABELS[s.site.planStatus]}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold leading-none" style={{ color: scoreColor(s.total) }}>{fmt0(s.total)}</div>
            <div className="text-[9px] text-slate-400">poäng</div>
          </div>
          <button className="btn-ghost -mr-1 px-2" onClick={onClose} aria-label="Stäng detaljvy">✕</button>
        </div>
        <nav className="mt-2 flex gap-1 overflow-x-auto text-xs font-medium" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-2 px-2 py-1.5 ${tab === t.id ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === 'oversikt' && (
          <div className="space-y-3">
            <Scorecard s={s} facilityType={req.facilityType} />
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              <KV k="Ledig effekt (bästa)" v={`${fmt0(s.bestStation.station.capacityWithdrawalMW)} MW`} sub={`${fmtKm(s.bestStation.distanceKm)} bort`} />
              <KV k="Effekt vid målår" v={`${fmt0(Math.max(0, s.bestStation.availableAtTargetMW))} MW`} sub={`behov ${fmt0(req.powerMW)} MW`} />
              <KV k="Markkostnad P50" v={`${fmtMSEK(s.earthworks.totalMSEK.p50)} MSEK`} sub={`${fmtMSEK(s.earthworks.totalMSEK.p10)}–${fmtMSEK(s.earthworks.totalMSEK.p90)} MSEK`} />
              <KV k="Grundläggning" v={FOUNDATION_SHORT[s.foundation.method]} sub={`regel ${s.foundation.rule}`} />
              <KV k="Jordart" v={SOIL_LABELS[g.soilType]} sub={`berg ca ${fmt1(g.depthToRockM)} m`} />
              <KV k="Logistik" v={`väg ${fmtKm(s.site.distanceToMajorRoadKm)}`} sub={`järnväg ${fmtKm(s.site.distanceToRailKm)}`} />
            </div>
            {s.warnings.length > 0 && (
              <ul className="space-y-1 text-xs">
                {s.warnings.map((w) => <li key={w} className="rounded bg-amber-50 px-2 py-1 text-amber-900">⚠ {w}</li>)}
              </ul>
            )}
            <div>
              <div className="label">Motivering</div>
              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-700">
                {s.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
            <SourceBox rows={[...siteSources(s), ...powerSources(s).slice(0, 1), ...groundSources(s).slice(0, 2)]} />
          </div>
        )}

        {tab === 'effekt' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Behov <b>{fmt0(req.powerMW)} MW</b> till <b>{req.targetConnectionYear}</b>. Antagande: 50 % av kön går före. Stationer inom {req.maxDistanceToSubstationKm} km bedöms.
            </p>
            {s.nearbyStations.map((e, i) => {
              const best = e.station.id === s.bestStation.station.id;
              return (
                <div key={e.station.id} className={`card p-2.5 text-xs ${best ? 'border-teal-500' : ''}`}>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[e.station.status] }} />
                    <span className="flex-1">{i + 1}. {e.station.name}</span>
                    {best && <span className="rounded bg-teal-100 px-1.5 text-[10px] text-teal-800">bästa</span>}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
                    <span className="text-slate-500">Avstånd</span><span className="sm:col-span-2">{fmtKm(e.distanceKm)}{e.distanceKm > req.maxDistanceToSubstationKm ? ' (utanför max)' : ''}</span>
                    <span className="text-slate-500">Nätnivå</span><span className="sm:col-span-2">{e.station.voltageKv} kV, {e.station.gridLevel} – {e.station.operator}</span>
                    <span className="text-slate-500">Ledig effekt</span><span className="sm:col-span-2">{fmt0(e.station.capacityWithdrawalMW)} MW</span>
                    <span className="text-slate-500">I kö</span><span className="sm:col-span-2">{fmt0(e.station.queuedMW)} MW</span>
                    <span className="text-slate-500">Uppgraderingar</span>
                    <span className="sm:col-span-2">{e.station.plannedUpgrades.length ? e.station.plannedUpgrades.map((u) => `${u.year}: +${fmt0(u.addedMW)} MW`).join(', ') : '–'}</span>
                    <span className="text-slate-500">Tillgängligt {req.targetConnectionYear}</span><span className="sm:col-span-2">{fmt0(e.availableAtTargetMW)} MW ({fmt0(e.ratioAtTarget * 100)} % av behov)</span>
                    <span className="text-slate-500">Bedömd tid till effekt</span>
                    <span className="font-semibold sm:col-span-2">{e.yearToPower <= CURRENT_YEAR ? 'Idag' : e.yearToPower >= 2035 ? '2035 eller senare' : e.yearToPower}</span>
                  </div>
                </div>
              );
            })}
            <SourceBox rows={powerSources(s)} />
          </div>
        )}

        {tab === 'mark' && (
          <div className="space-y-4">
            <Disclaimer />
            <div>
              <div className="label">Markmodell</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <KV k="Jordart (dominerande)" v={SOIL_LABELS[g.soilType]} sub={`jorddjup ${fmt1(g.soilDepthRangeM[0])}–${fmt1(g.soilDepthRangeM[1])} m`} />
                <KV k="Djup till berg" v={`${fmt1(g.depthToRockM)} ± ${fmt1(g.depthUncertaintyM)} m`}
                  sub={g.wellCount >= 3 ? `${g.wellCount} brunnar, snitt ${fmt1(g.meanWellDistanceKm ?? 0)} km` : `${g.wellCount} brunnar – modellerat`} />
                <KV k="Grundvatten" v={`${fmt1(g.groundwaterLevelM)} m`} sub="under markyta" />
                <KV k="Lutning" v={`${fmt1(g.terrain.meanSlopePct)} %`} sub={`ΔH ${fmt1(g.terrain.maxElevM - g.terrain.minElevM)} m`} />
                <KV k="Höjd" v={`${fmt0(g.terrain.meanElevM)} m ö.h.`} sub={`${fmt0(g.terrain.minElevM)}–${fmt0(g.terrain.maxElevM)} m`} />
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Tillförlitlighet</div>
                  <div className="mt-0.5"><ConfidenceBadge c={g.confidence} /></div>
                </div>
              </div>
            </div>
            <MassBalanceTable s={s} />
            <div>
              <div className="label">Kostnad markarbeten</div>
              <CostTable s={s} />
            </div>
            <SourceBox rows={groundSources(s)} />
          </div>
        )}

        {tab === 'grundlaggning' && (
          <div>
            <FoundationPanel s={s} />
            <SourceBox rows={groundSources(s).slice(0, 4)} />
          </div>
        )}
      </div>
    </div>
  );
}
