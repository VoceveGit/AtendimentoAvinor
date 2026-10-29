import { Check, GripVertical, MessageSquareWarning, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { COLOR_BADGE, COLOR_DOT, PALETTE } from "../lib/status";
import type { Motivo, Status } from "../lib/types";
import { cn } from "../lib/utils";

export function ConfigStatusPage() {
  const [items, setItems] = useState<Status[]>([]);
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("amber");
  const [motivo, setMotivo] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [motivoLabel, setMotivoLabel] = useState("");
  const [editingMotivo, setEditingMotivo] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = () => api<Status[]>("/api/statuses").then(setItems).catch((e: Error) => toast.error(e.message));
  const loadMotivos = () => api<Motivo[]>("/api/motivos").then(setMotivos).catch((e: Error) => toast.error(e.message));
  useEffect(() => {
    load();
    loadMotivos();
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

  const saveMotivo = async () => {
    if (!motivoLabel.trim()) return;
    try {
      if (editingMotivo) {
        await api(`/api/motivos/${editingMotivo}`, { method: "PATCH", body: JSON.stringify({ label: motivoLabel }) });
        toast.success("Motivo atualizado.");
      } else {
        await api("/api/motivos", { method: "POST", body: JSON.stringify({ label: motivoLabel }) });
        toast.success("Motivo cadastrado.");
      }
      setMotivoLabel("");
      setEditingMotivo(null);
      loadMotivos();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeMotivo = async (id: string) => {
    try {
      await api(`/api/motivos/${id}`, { method: "DELETE" });
      toast.success("Motivo removido.");
      loadMotivos();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleMotivoAtivo = async (m: Motivo) => {
    try {
      await api(`/api/motivos/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ label: m.label, active: !m.active }),
      });
      loadMotivos();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const customStatuses = items.filter((s) => !s.is_automatic && !s.is_system);
  const autoStatuses = items.filter((s) => s.is_automatic || s.is_system);

  const dropCustom = async (overId: string) => {
    if (!dragId || dragId === overId) {
      setDragId(null);
      return;
    }
    const next = [...customStatuses];
    const from = next.findIndex((s) => s.id === dragId);
    const to = next.findIndex((s) => s.id === overId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems([...next, ...autoStatuses]);
    setDragId(null);
    try {
      await api("/api/statuses/reorder", { method: "POST", body: JSON.stringify({ ids: next.map((s) => s.id) }) });
    } catch (e) {
      toast.error((e as Error).message);
      load();
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
            Arraste para definir a ordem do droplist no atendimento. Padrão entra sozinho no cliente do dia. · {customStatuses.length} itens
          </p>
        </div>
        <ul>
          {customStatuses.map((s) => (
            <li
              key={s.id}
              draggable
              onDragStart={() => setDragId(s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropCustom(s.id)}
              className={cn(
                "flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3",
                dragId === s.id && "bg-slate-50",
              )}
            >
              <GripVertical className="h-4 w-4 cursor-grab text-slate-400" />
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", COLOR_BADGE[s.color] || COLOR_BADGE.slate)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", COLOR_DOT[s.color])} />
                {s.label}
              </span>
              <span className="font-mono text-[11px] text-slate-400">id: {s.id}</span>
              <span className="ml-auto flex items-center gap-2">
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

      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-2">
        <div className="px-4 py-3">
          <h3 className="font-display text-base font-semibold text-slate-700">Status automáticos</h3>
          <p className="text-xs text-slate-400">
            Não se cadastra. O sistema aplica depois de uma ação: agendar data, finalizar venda, recuperação.
          </p>
        </div>
        <ul>
          {autoStatuses
            .filter((s) => ["agendado", "finalizado", "atendido", "em_recuperacao"].includes(s.id))
            .map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", COLOR_BADGE[s.color] || COLOR_BADGE.slate)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", COLOR_DOT[s.color])} />
                  {s.label}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 ring-1 ring-slate-200">
                  automático
                </span>
                <span className="text-xs text-slate-400">
                  {s.id === "agendado"
                    ? "Ao escolher a data de atendimento"
                    : s.id === "finalizado" || s.id === "atendido"
                      ? "Ao clicar em Finalizar e registrar o pedido"
                      : "Cliente parado na recuperação"}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        <p className="mb-1 text-sm font-semibold text-slate-800">Motivos de não venda / não recuperado</p>
        <p className="mb-3 text-xs text-slate-400">
          A vendedora só escolhe da lista. Nada de texto livre. Esses motivos entram nos relatórios do ADM.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={motivoLabel}
            onChange={(e) => setMotivoLabel(e.target.value)}
            placeholder="Ex: Preço alto"
            className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-avinor/40"
          />
          <button
            type="button"
            onClick={saveMotivo}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> {editingMotivo ? "Salvar motivo" : "Adicionar motivo"}
          </button>
          {editingMotivo && (
            <button
              type="button"
              onClick={() => {
                setEditingMotivo(null);
                setMotivoLabel("");
              }}
              className="text-sm font-bold text-slate-400"
            >
              Cancelar
            </button>
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-100 bg-white p-2 shadow-card">
        <div className="px-4 py-3">
          <h3 className="font-display text-base font-semibold">Motivos cadastrados</h3>
          <p className="text-xs text-slate-400">{motivos.length} itens · inativo some da lista da vendedora</p>
        </div>
        <ul>
          {motivos.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3">
              <span className="font-semibold text-slate-800">{m.label}</span>
              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleMotivoAtivo(m)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                    m.active !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400",
                  )}
                >
                  {m.active !== false ? "Ativo" : "Inativo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMotivo(m.id);
                    setMotivoLabel(m.label);
                  }}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => removeMotivo(m.id)} className="text-slate-400 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
          {motivos.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-400">Nenhum motivo ainda.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
