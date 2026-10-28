import { Check, GripVertical, MessageSquareWarning, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { COLOR_BADGE, COLOR_DOT, PALETTE } from "../lib/status";
import type { Status } from "../lib/types";
import { cn } from "../lib/utils";

export function ConfigStatusPage() {
  const [items, setItems] = useState<Status[]>([]);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("amber");
  const [motivo, setMotivo] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = () => api<Status[]>("/api/statuses").then(setItems).catch((e: Error) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!label.trim()) return;
    try {
      if (editing) {
        await api(`/api/statuses/${editing}`, {
          method: "PATCH",
          body: JSON.stringify({ label, color, requires_motivo: motivo }),
        });
        toast.success("Status atualizado.");
      } else {
        await api("/api/statuses", { method: "POST", body: JSON.stringify({ label, color, requires_motivo: motivo }) });
        toast.success("Status adicionado.");
      }
      setLabel("");
      setMotivo(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/statuses/${id}`, { method: "DELETE" });
      toast.success("Status removido.");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setColorNow = async (id: string, next: string) => {
    const current = items.find((s) => s.id === id);
    if (!current) return;
    await api(`/api/statuses/${id}`, { method: "PATCH", body: JSON.stringify({ label: current.label, color: next }) });
    load();
  };

  const toggleMotivo = async (s: Status) => {
    if (s.is_system) return;
    try {
      await api(`/api/statuses/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ label: s.label, color: s.color, requires_motivo: !s.requires_motivo }),
      });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setDefault = async (id: string) => {
    try {
      await api(`/api/statuses/${id}/default`, { method: "POST" });
      toast.success("Padrão do dia atualizado.");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        <p className="mb-3 text-sm font-semibold text-slate-800">Adicionar novo status</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Aguardando retorno"
            className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-avinor/40"
          />
          <div className="flex gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn("h-5 w-5 rounded-full ring-2 ring-offset-2", COLOR_DOT[c], color === c ? "ring-slate-400" : "ring-transparent")}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMotivo((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold",
              motivo ? "bg-amber-500 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200",
            )}
          >
            <MessageSquareWarning className="h-3.5 w-3.5" />
            Exige motivo
          </button>
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 rounded-lg bg-avinor px-4 py-2 text-sm font-semibold text-white hover:bg-avinor-600"
          >
            <Plus className="h-4 w-4" /> {editing ? "Salvar" : "Adicionar status"}
          </button>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-100 bg-white p-2 shadow-card">
        <div className="px-4 py-3">
          <h3 className="font-display text-base font-semibold">Status cadastrados</h3>
          <p className="text-xs text-slate-400">
            O status marcado como <span className="font-semibold text-slate-600">Padrão</span> entra sozinho quando o
            cliente é lançado no dia. <span className="font-semibold text-slate-600">Motivo</span> abre um campo
            obrigatório (Não venda, Não recuperado). · {items.length} itens
          </p>
        </div>
        <ul>
          {items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3">
              <GripVertical className="h-4 w-4 text-slate-300" />
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", COLOR_BADGE[s.color] || COLOR_BADGE.slate)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", COLOR_DOT[s.color])} />
                {s.label}
              </span>
              <span className="font-mono text-[11px] text-slate-400">id: {s.id}</span>
              <span className="ml-auto flex items-center gap-2">
                {!s.is_system && (
                  <button
                    type="button"
                    onClick={() => toggleMotivo(s)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                      s.requires_motivo
                        ? "bg-amber-500 text-white"
                        : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <MessageSquareWarning className="h-3 w-3" />
                    Motivo
                  </button>
                )}
                {!s.is_system && s.id !== "em_recuperacao" && (
                  <button
                    type="button"
                    onClick={() => setDefault(s.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                      s.is_default
                        ? "bg-avinor text-white"
                        : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {s.is_default && <Check className="h-3 w-3" />}
                    Padrão
                  </button>
                )}
                {PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => setColorNow(s.id, c)} className={cn("h-4 w-4 rounded-full", COLOR_DOT[c], s.color === c && "ring-2 ring-offset-1 ring-slate-400")} />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(s.id);
                    setLabel(s.label);
                    setColor(s.color);
                    setMotivo(Boolean(s.requires_motivo));
                  }}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => remove(s.id)} className="text-slate-400 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
