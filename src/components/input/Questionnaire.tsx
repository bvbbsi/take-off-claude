import { useMemo, useState, type ReactNode } from 'react';
import { COUNTIES } from '../../config/towns';
import {
  ALL_EL_AREAS, ALL_PLAN_STATUSES, CURRENT_YEAR, FACILITY_ICONS, FACILITY_LABELS, PLAN_STATUS_LABELS, RISK_LABELS,
} from '../../engine/requirements';
import { useAppStore } from '../../store/useAppStore';
import type { FacilityType, LoadClass, RequirementField, Requirements, RiskTolerance } from '../../types';

export const STEPS: { title: string; fields: RequirementField[] }[] = [
  { title: 'Typ av anläggning', fields: ['facilityType'] },
  { title: 'Effektbehov', fields: ['powerMW'] },
  { title: 'Tomtyta', fields: ['minAreaHa', 'maxAreaHa'] },
  { title: 'Önskat anslutningsår', fields: ['targetConnectionYear'] },
  { title: 'Geografi', fields: ['preferredElAreas', 'preferredRegions'] },
  { title: 'Byggnadens lastklass', fields: ['loadClass'] },
  { title: 'Markrisk och budget', fields: ['groundRiskTolerance', 'maxEarthworksBudgetMSEK'] },
  { title: 'Övrigt', fields: ['needsRail', 'wantsDistrictHeating', 'needsFiber', 'acceptedPlanStatus', 'maxDistanceToSubstationKm'] },
];

const LOAD_HELP: Record<LoadClass, string> = {
  latt: 'Lätta hallar, BESS-containrar på plintar, kontor.',
  medel: 'Normala industri- och lagerbyggnader, måttliga punktlaster.',
  tung: 'Datacenter, tung industri, höga lagerställ, vibrations- och sättningskänsligt.',
};
const RISK_HELP: Record<RiskTolerance, string> = {
  lag: 'Föredra platser med ytligt berg och gott underlag. Straffa osäkert underlag.',
  medel: 'Balans mellan markrisk och andra faktorer.',
  hog: 'Markförhållanden väger lätt – kostnaden redovisas ändå.',
};

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  );
}

function NumberInput({ value, onChange, min, max, step = 1, placeholder, suffix, id }: {
  value: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; step?: number; placeholder?: string; suffix: string; id?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        id={id}
        type="number"
        className="input w-28"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
      <span className="text-xs text-slate-500">{suffix}</span>
    </div>
  );
}

export function StepBody({ index }: { index: number }) {
  const r = useAppStore((s) => s.requirements);
  const setField = useAppStore((s) => s.setField);
  const setFacilityType = useAppStore((s) => s.setFacilityType);
  const clearField = useAppStore((s) => s.clearField);
  const set = <K extends RequirementField>(k: K, v: Requirements[K] | undefined) => (v === undefined ? clearField(k) : setField(k, v as Requirements[K]));

  switch (index) {
    case 0:
      return (
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(FACILITY_LABELS) as FacilityType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFacilityType(t)}
              aria-pressed={r.facilityType === t}
              className={`flex flex-col items-center gap-0.5 rounded-md border p-2 text-[11px] font-medium leading-tight transition ${r.facilityType === t ? 'border-teal-700 bg-teal-50 text-teal-900 ring-1 ring-teal-700' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <span className="text-xl">{FACILITY_ICONS[t]}</span>
              {FACILITY_LABELS[t]}
            </button>
          ))}
        </div>
      );
    case 1:
      return (
        <div className="space-y-2">
          <input type="range" min={1} max={500} value={Math.min(500, r.powerMW)} className="w-full accent-teal-700"
            aria-label="Effektbehov i MW" onChange={(e) => setField('powerMW', Number(e.target.value))} />
          <div className="flex flex-wrap items-center gap-1.5">
            <NumberInput value={r.powerMW} min={0.5} step={0.5} onChange={(v) => v !== undefined && v > 0 && setField('powerMW', v)} suffix="MW" />
            {[5, 20, 50, 100, 200].map((v) => (
              <Toggle key={v} active={r.powerMW === v} onClick={() => setField('powerMW', v)}>{v}</Toggle>
            ))}
          </div>
        </div>
      );
    case 2:
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-600" htmlFor="minha">Minst</label>
            <NumberInput id="minha" value={r.minAreaHa} min={0} step={0.5} onChange={(v) => setField('minAreaHa', v ?? 0)} suffix="ha" />
          </div>
          <div>
            <label className="text-xs text-slate-600" htmlFor="maxha">Gärna högst (valfritt)</label>
            <NumberInput id="maxha" value={r.maxAreaHa} min={0} step={0.5} placeholder="–" onChange={(v) => set('maxAreaHa', v)} suffix="ha" />
          </div>
        </div>
      );
    case 3:
      return (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => CURRENT_YEAR + 1 + i).map((y) => (
            <Toggle key={y} active={r.targetConnectionYear === y} onClick={() => setField('targetConnectionYear', y)}>{y}</Toggle>
          ))}
        </div>
      );
    case 4:
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {ALL_EL_AREAS.map((a) => (
              <Toggle key={a} active={r.preferredElAreas.includes(a)}
                onClick={() => {
                  const next = r.preferredElAreas.includes(a) ? r.preferredElAreas.filter((x) => x !== a) : [...r.preferredElAreas, a].sort();
                  setField('preferredElAreas', next);
                }}>
                {a}
              </Toggle>
            ))}
            <span className="self-center text-[11px] text-slate-500">Inget valt = alla</span>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-600">Län ({r.preferredRegions.length ? r.preferredRegions.length + ' valda' : 'alla'})</summary>
            <div className="mt-1 grid max-h-36 grid-cols-2 gap-x-2 overflow-auto">
              {COUNTIES.map((c) => (
                <label key={c} className="flex items-center gap-1">
                  <input type="checkbox" className="accent-teal-700" checked={r.preferredRegions.includes(c)}
                    onChange={() => setField('preferredRegions', r.preferredRegions.includes(c) ? r.preferredRegions.filter((x) => x !== c) : [...r.preferredRegions, c])} />
                  {c}
                </label>
              ))}
            </div>
          </details>
        </div>
      );
    case 5:
      return (
        <div className="space-y-1">
          {(['latt', 'medel', 'tung'] as LoadClass[]).map((l) => (
            <label key={l} className={`flex cursor-pointer gap-2 rounded-md border p-1.5 text-xs ${r.loadClass === l ? 'border-teal-700 bg-teal-50' : 'border-slate-200'}`}>
              <input type="radio" name="load" className="accent-teal-700" checked={r.loadClass === l} onChange={() => setField('loadClass', l)} />
              <span><b>{{ latt: 'Lätt', medel: 'Medel', tung: 'Tung' }[l]}</b> – {LOAD_HELP[l]}</span>
            </label>
          ))}
        </div>
      );
    case 6:
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            {(['lag', 'medel', 'hog'] as RiskTolerance[]).map((t) => (
              <label key={t} className={`flex cursor-pointer gap-2 rounded-md border p-1.5 text-xs ${r.groundRiskTolerance === t ? 'border-teal-700 bg-teal-50' : 'border-slate-200'}`}>
                <input type="radio" name="risk" className="accent-teal-700" checked={r.groundRiskTolerance === t} onChange={() => setField('groundRiskTolerance', t)} />
                <span><b>{RISK_LABELS[t]} tolerans</b> – {RISK_HELP[t]}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="text-xs text-slate-600" htmlFor="budget">Budget för markarbeten (valfritt)</label>
            <NumberInput id="budget" value={r.maxEarthworksBudgetMSEK} min={0} placeholder="–" onChange={(v) => set('maxEarthworksBudgetMSEK', v)} suffix="MSEK" />
          </div>
        </div>
      );
    default:
      return (
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-3">
            {([['needsRail', 'Järnväg (≤ 5 km)'], ['wantsDistrictHeating', 'Fjärrvärme/restvärme'], ['needsFiber', 'Fiber']] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-1">
                <input type="checkbox" className="accent-teal-700" checked={!!r[k]} onChange={(e) => setField(k, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
          <div>
            <div className="mb-1 text-slate-600">Accepterad planstatus</div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_PLAN_STATUSES.map((p) => (
                <Toggle key={p} active={r.acceptedPlanStatus.includes(p)}
                  onClick={() => {
                    const next = r.acceptedPlanStatus.includes(p) ? r.acceptedPlanStatus.filter((x) => x !== p) : ALL_PLAN_STATUSES.filter((x) => x === p || r.acceptedPlanStatus.includes(x));
                    if (next.length > 0) setField('acceptedPlanStatus', next);
                  }}>
                  {PLAN_STATUS_LABELS[p]}
                </Toggle>
              ))}
            </div>
          </div>
          <div>
            <label className="text-slate-600" htmlFor="maxdist">Max avstånd till station: <b>{r.maxDistanceToSubstationKm} km</b></label>
            <input id="maxdist" type="range" min={2} max={60} value={r.maxDistanceToSubstationKm} className="w-full accent-teal-700"
              onChange={(e) => setField('maxDistanceToSubstationKm', Number(e.target.value))} />
          </div>
        </div>
      );
  }
}

const isStepFilled = (i: number, r: Requirements) => STEPS[i].fields.some((f) => r._filledFields.includes(f));

/** Stegvis formulär (läge B). */
export function QuestionnaireWizard({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  const r = useAppStore((s) => s.requirements);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="label mb-0">Steg {step + 1} av {STEPS.length}: {STEPS[step].title}</div>
      </div>
      <div className="flex gap-1" role="tablist">
        {STEPS.map((s, i) => (
          <button key={s.title} role="tab" aria-selected={i === step} aria-label={s.title} title={s.title} onClick={() => setStep(i)}
            className={`h-1.5 flex-1 rounded-full ${i === step ? 'bg-teal-700' : isStepFilled(i, r) ? 'bg-teal-300' : 'bg-slate-200'}`} />
        ))}
      </div>
      <div className="min-h-[110px]"><StepBody index={step} /></div>
      <div className="flex justify-between">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>← Föregående</button>
        {step < STEPS.length - 1 && <button className="btn-secondary" onClick={() => setStep(step + 1)}>Nästa →</button>}
      </div>
    </div>
  );
}

/** Kombinationsläget: visa bara saknade frågor, ifyllda markeras "från din beskrivning". */
export function MissingQuestions({ focusStep }: { focusStep: number | null }) {
  const r = useAppStore((s) => s.requirements);
  const fromPrompt = useAppStore((s) => s.fromPrompt);
  const parseId = useAppStore((s) => s.parseId);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Frys vilka steg som saknades vid tolkningen så att listan inte hoppar när man svarar.
  const missing = useMemo(
    () => STEPS.map((_, i) => i).filter((i) => !isStepFilled(i, r)),
    [parseId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const open = (i: number) => showAll || missing.includes(i) || expanded === i || focusStep === i;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="label mb-0">{missing.length ? `${missing.length} frågor att komplettera` : 'Alla frågor besvarade'}</div>
        <button className="text-xs text-teal-700 hover:underline" onClick={() => setShowAll(!showAll)}>{showAll ? 'Visa bara saknade' : 'Visa alla frågor'}</button>
      </div>
      {STEPS.map((s, i) => {
        const fromDesc = s.fields.some((f) => fromPrompt.includes(f));
        const wasMissing = missing.includes(i);
        const answered = isStepFilled(i, r);
        if (!open(i)) {
          return (
            <button key={s.title} className="flex w-full items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-left text-xs hover:bg-slate-100" onClick={() => setExpanded(i)}>
              <span className="text-teal-700">✓</span>
              <span className="font-medium">{s.title}</span>
              {fromDesc && <span className="ml-auto rounded bg-teal-100 px-1.5 text-[10px] text-teal-800">från din beskrivning</span>}
            </button>
          );
        }
        return (
          <div key={s.title} className={`rounded-md border p-2 ${wasMissing && !answered ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white'}`}>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold">
              <span>{s.title}</span>
              {fromDesc && <span className="rounded bg-teal-100 px-1.5 text-[10px] font-normal text-teal-800">från din beskrivning</span>}
              {wasMissing && !answered && <span className="rounded bg-amber-200 px-1.5 text-[10px] font-normal text-amber-900">saknas – förval används</span>}
              {wasMissing && answered && <span className="text-[10px] font-normal text-teal-700">✓ besvarad</span>}
              {expanded === i && !showAll && !wasMissing && (
                <button className="ml-auto text-[10px] font-normal text-slate-500 hover:underline" onClick={() => setExpanded(null)}>Stäng</button>
              )}
            </div>
            <StepBody index={i} />
          </div>
        );
      })}
    </div>
  );
}
