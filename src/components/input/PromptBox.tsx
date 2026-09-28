import { getParser } from '../../engine/llmParser';
import { useAppStore } from '../../store/useAppStore';

const EXAMPLES = [
  'Datacenter 80 MW, minst 20 ha, norra Sverige, anslutning 2029',
  'Var kan jag ansluta 50 MW batterilager inom 2 år på 3 ha?',
  'Industri 10 MW, 15 ha, nära järnväg, tung last',
  'Logistikterminal 20 ha i Mälardalen, detaljplan klar, budget 60 MSEK för mark',
];

export function PromptBox({ onParsed, submitLabel = 'Tolka' }: { onParsed?: () => void; submitLabel?: string }) {
  const text = useAppStore((s) => s.promptText);
  const setText = useAppStore((s) => s.setPromptText);
  const applyParse = useAppStore((s) => s.applyParse);
  const parsing = useAppStore((s) => s.parsing);
  const setParsing = useAppStore((s) => s.setParsing);
  const hints = useAppStore((s) => s.unparsedHints);
  const parsed = useAppStore((s) => s.parsed);

  const run = async () => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const r = await getParser().parse(text);
      applyParse(r);
      onParsed?.();
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="label" htmlFor="prompt">Beskriv ditt behov</label>
      <textarea
        id="prompt"
        className="input min-h-[76px] resize-y"
        placeholder="T.ex. Datacenter 80 MW, minst 20 ha, gärna norra Sverige, anslutning senast 2029, tung byggnad."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run();
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={run} disabled={!text.trim() || parsing}>
          {parsing ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : '✨'} {submitLabel}
        </button>
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none">Exempel</summary>
          <ul className="mt-1 space-y-1">
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button className="text-left text-teal-700 hover:underline" onClick={() => setText(ex)}>{ex}</button>
              </li>
            ))}
          </ul>
        </details>
      </div>
      {parsed && hints.length > 0 && (
        <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Kunde inte tolka: {hints.map((h) => `"${h}"`).join(', ')}
        </p>
      )}
    </div>
  );
}
