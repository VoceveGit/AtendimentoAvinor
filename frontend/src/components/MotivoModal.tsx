import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useDemo } from "../lib/demo";
import { MOCK_MOTIVOS } from "../lib/mockData";
import type { Motivo } from "../lib/types";
import { cn } from "../lib/utils";

type Props = {
  title: string;
  hint?: string;
  onCancel: () => void;
  onConfirm: (motivo: string) => void;
};

export function MotivoModal({ title, hint, onCancel, onConfirm }: Props) {
  const { mock } = useDemo();
  const [items, setItems] = useState<Motivo[]>([]);
  const [picked, setPicked] = useState("");
  const [loading, setLoading] = useState(!mock);

  useEffect(() => {
    if (mock) {
      setItems(MOCK_MOTIVOS.map((label, i) => ({ id: String(i), label, active: true })));
      setLoading(false);
      return;
    }
    api<Motivo[]>("/api/motivos")
      .then((rows) => setItems((rows || []).filter((m) => m.active !== false)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [mock]);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-lift">
        <h3 className="font-display text-lg font-extrabold text-slate-900">{title}</h3>
        {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Carregando motivos…</p>
        ) : items.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
            Nenhum motivo cadastrado. O ADM inclui a lista em Configurar Status.
          </p>
        ) : (
          <ul className="mt-4 max-h-72 space-y-1.5 overflow-auto">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setPicked(m.label)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold ring-1 transition",
                    picked === m.label
                      ? "bg-avinor text-white ring-avinor"
                      : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                  )}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!picked}
            onClick={() => onConfirm(picked)}
            className="rounded-xl bg-avinor px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
