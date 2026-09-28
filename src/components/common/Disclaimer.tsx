export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-100 sm:text-xs ${className}`}>
      ⓘ Tidig screening – ersätter inte geoteknisk undersökning
    </span>
  );
}
