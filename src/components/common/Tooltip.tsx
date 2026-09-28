import type { ReactNode } from 'react';

/** Enkel tooltip (hover/fokus) utan beroenden. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex" tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden w-56 -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow group-hover:block group-focus:block"
      >
        {text}
      </span>
    </span>
  );
}
