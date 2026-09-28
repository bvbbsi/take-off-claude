import { useEffect } from 'react';
import { DEFAULT_UNIT_PRICES, UNIT_PRICE_DEFS } from '../../config/unitPrices';
import { useAppStore } from '../../store/useAppStore';

export function UnitPriceEditor() {
  const open = useAppStore((s) => s.priceEditorOpen);
  const setOpen = useAppStore((s) => s.setPriceEditorOpen);
  const prices = useAppStore((s) => s.unitPrices);
  const setPrice = useAppStore((s) => s.setUnitPrice);
  const reset = useAppStore((s) => s.resetUnitPrices);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  if (!open) return null;
  const changed = UNIT_PRICE_DEFS.filter((d) => prices[d.key] !== DEFAULT_UNIT_PRICES[d.key]).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Enhetspriser"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <div>
            <h2 className="font-semibold">Enhetspriser (mock)</h2>
            <p className="text-[11px] text-slate-500">Ändringar räknar om markkalkyl och rankning direkt. P50-värden i SEK exkl. moms.</p>
          </div>
          <button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Stäng">✕</button>
        </div>
        <div className="overflow-auto px-4 py-2">
          <table className="tbl">
            <thead><tr><th>Post</th><th>Enhet</th><th className="text-right">P50 (SEK)</th><th className="hidden sm:table-cell">Kommentar</th></tr></thead>
            <tbody>
              {UNIT_PRICE_DEFS.map((d) => {
                const modified = prices[d.key] !== DEFAULT_UNIT_PRICES[d.key];
                return (
                  <tr key={d.key}>
                    <td className="align-middle">{d.post}</td>
                    <td className="align-middle text-slate-500">{d.unit}</td>
                    <td className="text-right">
                      <input
                        type="number"
                        min={0}
                        step={d.p50 < 10 ? 0.1 : d.p50 < 1000 ? 5 : 10000}
                        className={`input w-28 text-right tabular-nums ${modified ? 'border-amber-400 bg-amber-50' : ''}`}
                        value={prices[d.key]}
                        aria-label={`${d.post} (${d.unit})`}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v >= 0) setPrice(d.key, v);
                        }}
                      />
                    </td>
                    <td className="hidden align-middle text-slate-500 sm:table-cell">{d.comment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5">
          <span className="text-xs text-slate-500">{changed ? `${changed} ändrade` : 'Standardpriser'}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={reset} disabled={!changed}>Återställ</button>
            <button className="btn-primary" onClick={() => setOpen(false)}>Klar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
