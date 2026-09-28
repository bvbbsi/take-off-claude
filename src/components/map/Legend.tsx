import { useState } from 'react';
import { SOIL_LABELS } from '../../engine/groundModel';
import { useAppStore } from '../../store/useAppStore';
import type { SoilType } from '../../types';
import { PLANNING_COLORS, PLANNING_KIND_LABELS, RESTRICTION_COLORS, SOIL_COLORS, STATUS_COLORS, WELL_STEPS } from './mapStyle';

const Item = ({ color, label, shape = 'box', dashed }: { color: string; label: string; shape?: 'box' | 'dot'; dashed?: boolean }) => (
  <div className="flex items-center gap-1.5">
    <span
      className={`inline-block h-2.5 w-2.5 ${shape === 'dot' ? 'rounded-full' : 'rounded-sm'} ${dashed ? 'border border-dashed' : ''}`}
      style={dashed ? { borderColor: color, background: `${color}22` } : { background: color }}
    />
    <span>{label}</span>
  </div>
);

export function Legend() {
  const layers = useAppStore((s) => s.layers);
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);
  const sections: JSX.Element[] = [];

  if (layers.top) {
    sections.push(
      <div key="top">
        <div className="font-semibold">Total poäng</div>
        <Item color="#059669" label="≥ 75" /><Item color="#65a30d" label="50–74" /><Item color="#d97706" label="30–49" /><Item color="#dc2626" label="< 30" />
      </div>,
    );
  }
  if (layers.substations) {
    sections.push(
      <div key="ss">
        <div className="font-semibold">Stationer (storlek = kV)</div>
        <Item shape="dot" color={STATUS_COLORS.green} label="Grön – god kapacitet" />
        <Item shape="dot" color={STATUS_COLORS.amber} label="Gul – begränsad" />
        <Item shape="dot" color={STATUS_COLORS.red} label="Röd – ansträngd/kö" />
      </div>,
    );
  }
  if (layers.soils) {
    sections.push(
      <div key="soil">
        <div className="font-semibold">Jordarter</div>
        {(Object.keys(SOIL_COLORS) as SoilType[]).map((k) => <Item key={k} color={SOIL_COLORS[k]} label={SOIL_LABELS[k]} />)}
      </div>,
    );
  }
  if (layers.wells) {
    sections.push(
      <div key="wells">
        <div className="font-semibold">Brunnar – djup till berg</div>
        {WELL_STEPS.map(([v, c], i) => (
          <Item key={v} shape="dot" color={c} label={i < WELL_STEPS.length - 1 ? `${v}–${WELL_STEPS[i + 1][0]} m` : `≥ ${v} m`} />
        ))}
      </div>,
    );
  }
  if (layers.restrictions) {
    sections.push(
      <div key="restr">
        <div className="font-semibold">Restriktioner</div>
        {Object.entries(RESTRICTION_COLORS).map(([k, c]) => (
          <Item key={k} dashed color={c} label={`${PLANNING_KIND_LABELS[k as keyof typeof PLANNING_KIND_LABELS]}${k === 'natura2000' || k === 'naturreservat' ? ' (blockerande)' : ''}`} />
        ))}
      </div>,
    );
  }
  if (layers.planning) {
    sections.push(
      <div key="plan">
        <div className="font-semibold">Planområden</div>
        {Object.entries(PLANNING_COLORS).map(([k, c]) => <Item key={k} color={c} label={PLANNING_KIND_LABELS[k as keyof typeof PLANNING_KIND_LABELS]} />)}
      </div>,
    );
  }
  if (layers.quarries) {
    sections.push(
      <div key="q">
        <div className="font-semibold">Täkter</div>
        <Item color="#e7e5e4" label="Täkt (ballast)" />
        <Item color="#fde68a" label="Tar emot massor" />
      </div>,
    );
  }

  if (sections.length === 0) return null;
  return (
    <div className="absolute bottom-8 right-2 z-10 max-h-[45%] w-48 overflow-auto rounded-lg border border-slate-200 bg-white/95 text-[11px] shadow-md backdrop-blur">
      <button className="flex w-full items-center justify-between px-2.5 py-1.5 text-xs font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>Legend</span>
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="space-y-2 border-t border-slate-100 px-2.5 py-2">{sections}</div>}
    </div>
  );
}
