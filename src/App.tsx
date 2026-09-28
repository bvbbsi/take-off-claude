import { useEffect, useState } from 'react';
import { InputPanel } from './components/input/InputPanel';
import { MapView } from './components/map/MapView';
import { ResultList } from './components/results/ResultList';
import { SiteDrawer } from './components/results/SiteDrawer';
import { UnitPriceEditor } from './components/calc/UnitPriceEditor';
import { MockBanner } from './components/common/MockBanner';
import { Disclaimer } from './components/common/Disclaimer';
import { useAppStore } from './store/useAppStore';
import { useRanking, useSelectedSite } from './store/useRanking';

function useIsDesktop() {
  const query = '(min-width: 768px)';
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

export default function App() {
  const ranking = useRanking();
  const selected = useSelectedSite(ranking);
  const selectSite = useAppStore((s) => s.selectSite);
  const sheetOpen = useAppStore((s) => s.mobileSheetOpen);
  const setSheetOpen = useAppStore((s) => s.setMobileSheetOpen);
  const setPriceEditorOpen = useAppStore((s) => s.setPriceEditorOpen);
  const isDesktop = useIsDesktop();

  const leftPanel = (
    <div className="space-y-4 p-3">
      <InputPanel />
      <hr className="border-slate-200" />
      <ResultList ranking={ranking} />
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="z-30 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-white px-3 py-1.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          <span className="font-bold tracking-tight text-teal-900">Sitefinder</span>
          <span className="hidden text-xs text-slate-400 lg:inline">Platsanalys för mark, effekt och markkalkyl</span>
        </div>
        <MockBanner />
        <Disclaimer className="hidden sm:inline-flex" />
        <button className="btn-ghost ml-auto hidden px-2 py-1 text-xs md:inline-flex" onClick={() => setPriceEditorOpen(true)}>
          ✎ Enhetspriser
        </button>
        <Disclaimer className="w-full justify-center sm:hidden" />
      </header>

      {isDesktop ? (
        <main className="flex min-h-0 flex-1">
          <aside className="w-[360px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:w-[380px]">{leftPanel}</aside>
          <div className="relative min-w-0 flex-1">
            <MapView ranking={ranking} selected={selected} />
          </div>
          {selected && (
            <aside className="w-[400px] shrink-0 border-l border-slate-200 lg:w-[440px]">
              <SiteDrawer s={selected} onClose={() => selectSite(null)} />
            </aside>
          )}
        </main>
      ) : (
        <main className="relative min-h-0 flex-1">
          <MapView ranking={ranking} selected={selected} />
          {/* Bottom sheet */}
          <div
            className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.12)] transition-[height] duration-300 ${sheetOpen ? 'h-[62%]' : 'h-12'}`}
          >
            <button className="flex h-12 shrink-0 flex-col items-center justify-center" onClick={() => setSheetOpen(!sheetOpen)} aria-expanded={sheetOpen}>
              <span className="h-1 w-10 rounded-full bg-slate-300" />
              <span className="mt-1 text-xs font-medium text-slate-600">
                {ranking ? `Topp ${ranking.top.length} · krav` : 'Beskriv behov'} {sheetOpen ? '▾' : '▴'}
              </span>
            </button>
            {sheetOpen && <div className="min-h-0 flex-1 overflow-y-auto">{leftPanel}</div>}
          </div>
          {/* Detaljvy som modal */}
          {selected && (
            <div className="absolute inset-0 z-40 flex flex-col bg-slate-900/30">
              <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-t-2xl shadow-xl">
                <SiteDrawer s={selected} onClose={() => selectSite(null)} />
              </div>
            </div>
          )}
        </main>
      )}
      <UnitPriceEditor />
    </div>
  );
}
