export function Busy({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-white/55 backdrop-blur-[1px]">
      <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-slate-600 shadow-card ring-1 ring-slate-100">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-avinor border-t-transparent" />
        Atualizando…
      </div>
    </div>
  );
}
