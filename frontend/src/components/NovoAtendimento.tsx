import { Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import type { Client } from "../lib/types";

type Props = {
  vendedor: string;
  onAdded: () => void;
};

export function NovoAtendimento({ vendedor, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setItems([]);
      return;
    }
    const t = window.setTimeout(() => {
      const params = new URLSearchParams({ q: q.trim() });
      if (vendedor && vendedor !== "todas") params.set("vendedor", vendedor);
      setLoading(true);
      api<{ items: Client[] }>(`/api/clients/search?${params}`)
        .then((r) => setItems(r.items))
        .catch((e: Error) => toast.error(e.message))
        .finally(() => setLoading(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [q, open, vendedor]);

  const add = async (c: Client) => {
    setBusyId(c.id);
    try {
      await api(`/api/clients/${c.id}/today`, { method: "POST" });
      toast.success(`${c.nome} entrou no atendimento de hoje.`);
      setOpen(false);
      setQ("");
      onAdded();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-avinor px-3.5 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-avinor-600"
      >
        <Plus className="h-4 w-4" />
        Novo atendimento
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh]">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-lift">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-extrabold text-slate-900">Novo atendimento</h3>
                <p className="text-sm font-medium text-slate-500">
                  Busque na carteira por nome, código ou CPF/CNPJ — mesmo fora da rota de hoje.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome, #código ou CPF/CNPJ"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-avinor/40"
              />
            </div>
            <ul className="mt-3 max-h-80 overflow-y-auto">
              {loading && <li className="px-2 py-4 text-sm text-slate-400">Buscando...</li>}
              {!loading && q.trim().length >= 2 && items.length === 0 && (
                <li className="px-2 py-4 text-sm text-slate-400">Nenhum cliente nessa busca.</li>
              )}
              {items.map((c) => (
                <li key={c.id} className="border-t border-slate-100 py-2.5 first:border-t-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-slate-900">{c.nome}</p>
                      <p className="text-[11px] font-semibold text-slate-400">
                        #{String(c.id).padStart(5, "0")}
                        {c.cpf ? ` · ${c.cpf}` : ""}
                        {c.cidade ? ` · ${c.cidade}` : ""}
                        {c.vendedor_nome ? ` · ${c.vendedor_nome}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => add(c)}
                      className="shrink-0 rounded-lg bg-avinor px-3 py-1.5 text-xs font-extrabold text-white hover:bg-avinor-600 disabled:opacity-50"
                    >
                      {busyId === c.id ? "..." : "Inserir"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
