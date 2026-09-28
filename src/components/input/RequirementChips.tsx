import { useAppStore } from '../../store/useAppStore';
import { CHIP_ORDER, chipText } from './fieldText';
import type { RequirementField } from '../../types';

export function RequirementChips({ onEdit }: { onEdit: (field: RequirementField) => void }) {
  const req = useAppStore((s) => s.requirements);
  const fromPrompt = useAppStore((s) => s.fromPrompt);
  const clearField = useAppStore((s) => s.clearField);

  const chips = CHIP_ORDER
    .map((field) => ({ field, text: chipText(field, req), filled: req._filledFields.includes(field) }))
    .filter((c): c is { field: RequirementField; text: string; filled: boolean } => c.text !== null)
    // Visa angivna krav samt standardkrav som påverkar filtreringen
    .filter((c) => c.filled || ['facilityType', 'powerMW', 'minAreaHa', 'targetConnectionYear', 'preferredElAreas'].includes(c.field));

  return (
    <div>
      <div className="label">Krav</div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c.field}
            className={`inline-flex items-center overflow-hidden rounded-full border text-xs ${
              c.filled
                ? fromPrompt.includes(c.field) ? 'border-teal-300 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-800'
                : 'border-dashed border-slate-300 bg-slate-50 text-slate-500'
            }`}
            title={c.filled ? (fromPrompt.includes(c.field) ? 'Från din beskrivning' : 'Angivet') : 'Standardvärde'}
          >
            <button className="py-0.5 pl-2 pr-1 hover:underline" onClick={() => onEdit(c.field)}>{c.text}</button>
            {c.filled && (
              <button aria-label={`Ta bort ${c.text}`} className="px-1.5 py-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" onClick={() => clearField(c.field)}>
                ✕
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
