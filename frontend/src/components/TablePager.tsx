import { cn } from "../lib/utils";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
};

function visiblePages(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  const sorted = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

export function TablePager({ page, pageSize, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
      <span>
        Mostrando {from}–{to} de {total} clientes
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="px-2 py-1 disabled:opacity-40"
        >
          « Anterior
        </button>
        {visiblePages(page, pages).map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              className={cn("h-7 min-w-7 rounded-md px-1.5", n === page ? "bg-avinor text-white" : "hover:bg-slate-100")}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="px-2 py-1 disabled:opacity-40"
        >
          Próximo »
        </button>
      </div>
    </div>
  );
}
