import { useState } from 'react';
import { useAppStore, type InputMode } from '../../store/useAppStore';
import type { RequirementField } from '../../types';
import { FIELD_STEP } from './fieldText';
import { PromptBox } from './PromptBox';
import { MissingQuestions, QuestionnaireWizard } from './Questionnaire';
import { RequirementChips } from './RequirementChips';

const MODES: { id: InputMode; label: string }[] = [
  { id: 'kombination', label: 'Kombination' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'formular', label: 'Formulär' },
];

export function InputPanel() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const parsed = useAppStore((s) => s.parsed);
  const searched = useAppStore((s) => s.searched);
  const search = useAppStore((s) => s.search);
  const resetAll = useAppStore((s) => s.resetAll);
  const [step, setStep] = useState(0);
  const [focusStep, setFocusStep] = useState<number | null>(null);

  const onEditChip = (field: RequirementField) => {
    const target = FIELD_STEP[field];
    if (mode === 'formular') setStep(target);
    else {
      if (mode === 'prompt') setMode('kombination');
      setFocusStep(target);
    }
  };

  return (
    <section className="space-y-3" aria-label="Behovsinmatning">
      <div className="flex rounded-md bg-slate-100 p-0.5 text-xs font-medium" role="tablist">
        {MODES.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}
            className={`flex-1 rounded px-2 py-1 transition ${mode === m.id ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'prompt' && <PromptBox submitLabel="Tolka och sök" onParsed={search} />}

      {mode === 'kombination' && (
        <>
          <PromptBox />
          {parsed ? (
            <MissingQuestions focusStep={focusStep} />
          ) : (
            <p className="text-xs text-slate-500">
              Skriv en beskrivning och klicka <b>Tolka</b> – eller{' '}
              <button className="text-teal-700 hover:underline" onClick={() => setMode('formular')}>svara på frågorna direkt</button>.
            </p>
          )}
        </>
      )}

      {mode === 'formular' && <QuestionnaireWizard step={step} setStep={setStep} />}

      <RequirementChips onEdit={onEditChip} />

      <div className="flex gap-2">
        <button className="btn-primary flex-1 py-2" onClick={search}>
          🔍 {searched ? 'Sök igen' : 'Sök platser'}
        </button>
        <button className="btn-ghost" onClick={() => { resetAll(); setStep(0); setFocusStep(null); }} title="Börja om">↺</button>
      </div>
      {searched && <p className="text-[11px] text-slate-500">Resultatet uppdateras direkt när du ändrar krav eller enhetspriser.</p>}
    </section>
  );
}
