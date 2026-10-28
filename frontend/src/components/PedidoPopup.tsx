import { FileText, X } from "lucide-react";
import { formatDate, formatMoney } from "../lib/utils";

export type PedidoView = {
  codigo?: string;
  cliente_nome?: string;
  valor_total?: number;
  itens?: { descricao?: string; qtd?: number; valor?: number; produto?: string; um?: string }[];
  data_pedido?: string | null;
  data_emissao?: string | null;
  status?: string;
  found?: boolean;
  vendedor_nome?: string;
  created_by?: string;
  cidade?: string | null;
};

export function PedidoPopup({ data, onClose }: { data: PedidoView; onClose: () => void }) {
  const itens = data.itens || [];
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/45 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-lift">
        <div className="flex items-start justify-between bg-night px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-avinor">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-orange-300">
                Pedido {data.codigo || "—"}
              </p>
              <h3 className="font-display text-xl font-extrabold leading-tight">{data.cliente_nome || "Consulta"}</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {data.cidade ? `${data.cidade} · ` : ""}
                {data.status || "Consulta ERP"}
                {data.found === false ? " · ainda não conferido" : ""}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 px-6 py-5 sm:grid-cols-4">
          <Info label="Valor total" value={formatMoney(data.valor_total)} strong />
          <Info label="Status ERP" value={data.status || "Consulta"} />
          <Info label="Data do pedido" value={formatDate(data.data_pedido)} />
          <Info label="Emissão / entrega" value={formatDate(data.data_emissao)} />
        </div>
        <div className="px-6">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Quem fechou</p>
            <p className="font-extrabold text-slate-800">{data.vendedor_nome || data.created_by || "—"}</p>
          </div>
        </div>
        <div className="px-6 pb-6 pt-4">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Itens do pedido</p>
          <ul className="max-h-[38vh] overflow-y-auto rounded-2xl border border-slate-100">
            {itens.map((it, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3 first:border-t-0"
              >
                <div className="min-w-0">
                  {it.produto && (
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-orange-500">
                      {skuLabel(it.produto)}
                    </p>
                  )}
                  <p className="font-extrabold uppercase tracking-wide text-slate-900">
                    {it.descricao}
                    {it.qtd != null ? <span className="ml-2 font-bold text-slate-400">× {it.qtd}</span> : null}
                  </p>
                </div>
                <p className="shrink-0 font-black text-slate-900">{formatMoney(it.valor)}</p>
              </li>
            ))}
            {!itens.length && (
              <li className="px-4 py-8 text-center text-sm text-slate-400">
                Sem itens no banco ainda — use Atualizar pedidos depois da entrega.
              </li>
            )}
          </ul>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Total da nota</span>
            <span className="font-display text-2xl font-black text-slate-900">{formatMoney(data.valor_total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function skuLabel(p: string) {
  const n = Number(p);
  return Number.isFinite(n) ? String(Math.trunc(n)) : p;
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={strong ? "font-display text-lg font-black text-emerald-700" : "font-extrabold text-slate-800"}>
        {value}
      </p>
    </div>
  );
}
