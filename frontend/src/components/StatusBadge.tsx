import { CalendarDays, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { COLOR_BADGE, COLOR_DOT } from "../lib/status";
import type { Status } from "../lib/types";
import { cn } from "../lib/utils";

export const AUTO_STATUS_IDS = new Set([
  "agendado",
  "finalizado",
  "atendido",
  "em_recuperacao",
  "visita_marcada",
  "remarcado",
  "sem_status",
]);

type Extra = { data_atendimento?: string; clear_agenda?: boolean; origem?: "carteira" | "recuperacao" };

type Props = {
  status?: Status | null;
  statuses: Status[];
  origem?: "carteira" | "recuperacao";
  dataAtendimento?: string | null;
  onChange: (statusId: string, extra?: Extra) => void;
  onNeedMotivo?: (status: Status) => void;
};

export function pickerStatuses(statuses: Status[], origem: "carteira" | "recuperacao" = "carteira") {
  return statuses.filter((s) => {
    if (s.is_automatic || s.is_system || AUTO_STATUS_IDS.has(s.id)) return false;
    if (origem !== "recuperacao" && s.id === "nao_recuperado") return false;
    if (origem === "recuperacao" && s.id === "nao_venda") return false;
    return true;
  });
}

export function shownStatus(
  status: Status | null | undefined,
  statuses: Status[],
  dataAtendimento?: string | null,
) {
  if (dataAtendimento && !["finalizado", "atendido"].includes(status?.id || "")) {
    return (
      statuses.find((s) => s.id === "agendado") || {
        id: "agendado",
        label: "Agendado",
        color: "purple",
        is_automatic: true,
      }
    );
  }
  if (status?.id === "finalizado" || status?.id === "atendido") {
    return status;
  }
  if (status?.id && status.id !== "sem_status" && !AUTO_STATUS_IDS.has(status.id)) return status;
  if (status?.id && status.id !== "sem_status") return status;
  return statuses.find((s) => s.is_default && !s.is_automatic) || statuses.find((s) => s.id === "atendimento_hoje") || null;
}

export function StatusBadge({
  status,
  statuses,
  origem = "carteira",
  dataAtendimento,
  onChange,
  onNeedMotivo,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const shown = shownStatus(status, statuses, dataAtendimento);
  const color = shown?.color || "slate";
  const isAgendado = Boolean(dataAtendimento) && !["finalizado", "atendido"].includes(status?.id || "");

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setPickingDate(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const btn = btnRef.current;
      const menu = menuRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const menuW = menu?.offsetWidth || 224;
      const menuH = menu?.offsetHeight || 280;
      const gap = 8;
      let left = r.right - menuW;
      if (left < 8) left = 8;
      if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
      const spaceBelow = window.innerHeight - r.bottom - gap;
      const openUp = spaceBelow < menuH && r.top > menuH + gap;
      const top = openUp ? r.top - menuH - gap : r.bottom + gap;
      setMenuPos({ top, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, pickingDate]);

  const visible = pickerStatuses(statuses, origem);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setPickingDate(false);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition hover:brightness-95",
          COLOR_BADGE[color] || COLOR_BADGE.slate,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", COLOR_DOT[color] || COLOR_DOT.slate)} />
        {shown?.label || "Atendimento Hoje"}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[80] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-xl"
          >
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Alterar status
            </p>
            {visible.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.requires_motivo && onNeedMotivo) {
                    onNeedMotivo(s);
                    setOpen(false);
                    return;
                  }
                  onChange(s.id);
                  setOpen(false);
                  setPickingDate(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className={cn("h-2 w-2 rounded-full", COLOR_DOT[s.color] || COLOR_DOT.slate)} />
                {s.label}
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            {pickingDate ? (
              <div className="px-3 py-1">
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onChange("agendado", { data_atendimento: e.target.value, origem });
                    setOpen(false);
                    setPickingDate(false);
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPickingDate(true)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Definir data de atendimento
              </button>
            )}
            {isAgendado && (
              <button
                type="button"
                onClick={() => {
                  onChange("agendado", { clear_agenda: true, origem });
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                Tirar agendamento
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function StatusPicker({ status, statuses, origem = "carteira", dataAtendimento, onChange, onNeedMotivo }: Props) {
  const visible = pickerStatuses(statuses, origem);
  const current = shownStatus(status, statuses, dataAtendimento)?.id;
  return (
    <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
      {visible.map((s) => {
        const on = current === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (s.requires_motivo && onNeedMotivo) {
                onNeedMotivo(s);
                return;
              }
              onChange(s.id);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-extrabold ring-1 transition",
              on ? COLOR_BADGE[s.color] || COLOR_BADGE.slate : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50",
              on && "ring-2",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", COLOR_DOT[s.color] || COLOR_DOT.slate)} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
