import { useState } from "react";

type Props = {
  title: string;
  hint?: string;
  onCancel: () => void;
  onConfirm: (motivo: string) => void;
};

export function MotivoModal({ title, hint, onCancel, onConfirm }: Props) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-lift">
        <h3 className="font-display text-lg font-extrabold text-slate-900">{title}</h3>
        {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={4}
          placeholder="Escreva o motivo…"
          className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-avinor/40"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!motivo.trim()}
            onClick={() => onConfirm(motivo.trim())}
            className="rounded-xl bg-avinor px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
