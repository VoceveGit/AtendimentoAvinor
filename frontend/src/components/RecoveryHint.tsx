import { HelpCircle, Phone, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Client } from "../lib/types";
import { cn, formatDate, formatMoney, formatPhone, telHref } from "../lib/utils";

type Props = {
  client: Client;
  side?: "left" | "right";
  onClose: () => void;
};

export function RecoveryHint({ client, side = "right", onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const href = telHref(client.telefone);
  const top = (client.produtos_top || []).slice(0, 3);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current) return;
      if (!box.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={box}
      className={cn(
        "absolute top-0 z-30 w-[268px] rounded-2xl border border-slate-100/90 bg-white p-4 shadow-lift",
        side === "right" ? "left-[calc(100%+12px)]" : "right-[calc(100%+12px)]",
      )}
    >
      <span
        className={cn(
          "absolute top-6 h-2.5 w-2.5 rotate-45 border-slate-100 bg-white",
          side === "right" ? "-left-[6px] border-b border-l" : "-right-[6px] border-r border-t",
        )}
      />
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
          <HelpCircle className="h-3 w-3 text-avinor" />
          Dica de oferta
        </span>
        <button type="button" onClick={onClose} className="rounded-full p-0.5 text-slate-300 hover:bg-slate-50 hover:text-slate-500">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-3 font-display text-[22px] font-black leading-tight tracking-tight text-slate-900">{client.nome}</p>
      {href ? (
        <a
          href={href}
          className="mt-3 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-base font-black text-orange-700 transition hover:bg-orange-100"
        >
          <Phone className="h-4 w-4" />
          {formatPhone(client.telefone)}
        </a>
      ) : (
        <p className="mt-3 text-sm font-bold text-slate-400">Sem telefone</p>
      )}
      <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Última compra</p>
      <p className="mt-0.5 text-sm font-extrabold text-slate-700">{formatDate(client.ultima_compra)}</p>
      <p className="mt-4 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
        <ShoppingBag className="h-3 w-3" />
        Mais compra
      </p>
      {top.length === 0 ? (
        <p className="mt-1.5 text-xs font-medium text-slate-400">Sem histórico de produto ainda.</p>
      ) : (
        <ol className="mt-1.5 space-y-1">
          {top.map((p, i) => (
            <li key={`${p.nome}-${i}`} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-bold text-slate-700">
                <span className="mr-1.5 font-black text-slate-300">{i + 1}</span>
                {p.nome}
              </span>
              <span className="shrink-0 text-[11px] font-extrabold text-slate-400">{formatMoney(p.valor)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
