import { ChevronDown, PackageSearch, RefreshCw, Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CollaboratorFilter } from "../components/CollaboratorFilter";
import { PedidoPopup, type PedidoView } from "../components/PedidoPopup";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDemo } from "../lib/demo";
import { MOCK_FINALIZED } from "../lib/mockData";
import type { Colaboradora } from "../lib/types";
import { cn, formatDate, formatMoney, formatTime } from "../lib/utils";

export type Finalizado = {
  id: number;
  cliente_id: number;
  cliente_nome?: string;
  dia: string;
  vendedor_nome?: string;
  origem: string;
  situacao: string;
  kind: string;
  codigo_pedido?: string | null;
  valor_total?: number | null;
  itens?: PedidoView["itens"];
  synced: boolean;
  cidade?: string | null;
  rota_nome?: string | null;
  data_pedido?: string | null;
  data_emissao?: string | null;
  created_by?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

function chips() {
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(Date.now() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const label =
      i === 0 ? `Hoje · ${iso.slice(8, 10)}/${iso.slice(5, 7)}` : i === 1 ? `Ontem · ${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso.slice(8, 10) + "/" + iso.slice(5, 7);
    return { iso, label };
  });
  return days;
}

const GIRL_BY_ID: Record<number, string> = { 1071: "Poliana", 1072: "Fernanda", 1073: "Karolline" };

export function FinalizadosPage() {
  const { role, user } = useAuth();
  const { mock, closes } = useDemo();
  const [dia, setDia] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendedor, setVendedor] = useState("todas");
  const [items, setItems] = useState<Finalizado[]>([]);
  const [team, setTeam] = useState<Colaboradora[]>([]);
  const [popup, setPopup] = useState<PedidoView | null>(null);
  const [consulta, setConsulta] = useState("");
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const load = () => {
    if (mock) return;
    const params = new URLSearchParams({ dia, kind: "finalizado" });
    if (vendedor !== "todas") params.set("vendedor", vendedor);
    api<{ items: Finalizado[] }>(`/api/finalized?${params}`)
      .then((r) => setItems(r.items || []))
      .catch((e: Error) => toast.error(e.message));
    api<{ colaboradoras?: Colaboradora[] }>("/api/clients/today?page_size=1")
      .then((r) => setTeam(r.colaboradoras || []))
      .catch(() => undefined);
  };

  useEffect(() => {
    if (mock) {
      const today = new Date().toISOString().slice(0, 10);
      const mineName = role === "colaborador" ? user?.nome : vendedor === "todas" ? null : GIRL_BY_ID[Number(vendedor)];
      const recovered = Object.values(closes)
        .filter((c) => c.kind === "finalizado")
        .filter(() => dia === today)
        .map((c) => ({
          id: 8000 + c.cliente_id,
          cliente_id: c.cliente_id,
          cliente_nome: c.cliente_nome,
          dia: today,
          vendedor_nome: user?.nome,
          origem: c.origem || "recuperacao",
          situacao: c.origem === "carteira" ? "Da carteira" : "Recuperado",
          kind: "finalizado",
          codigo_pedido: c.codigo || "DEMO",
          valor_total: c.valor ?? 0,
          synced: Boolean(c.codigo),
          cidade: c.cidade,
          created_by: user?.nome,
          created_at: c.at,
        }));
      const list = dia === today ? [...MOCK_FINALIZED, ...recovered] : [];
      setItems(list.filter((it) => (mineName ? it.vendedor_nome === mineName : true)));
      setTeam([
        { id: 1071, nome: "Poliana", login: "poliana" },
        { id: 1072, nome: "Fernanda", login: "fernanda" },
        { id: 1073, nome: "Karolline", login: "karolline" },
      ]);
      return;
    }
    setItems([]);
    load();
  }, [dia, vendedor, mock, role, user?.nome, closes]);

  const sync = async () => {
    if (mock) {
      toast.message("Modo demonstração — Atualizar com a base só no modo real.");
      return;
    }
    try {
      const r = await api<{ updated: number; pending: number }>("/api/finalized/sync", { method: "POST" });
      toast.success(`${r.updated} pedido(s) atualizados. ${r.pending} ainda pendentes.`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const consultar = async () => {
    if (!consulta.trim()) return;
    setAsking(true);
    try {
      const data = await api<PedidoView>(`/api/pedidos/lookup?codigo=${encodeURIComponent(consulta.trim())}`);
      if (!data.found) {
        toast.message("Código não encontrado no EXTRACTOR ainda.");
        return;
      }
      setPopup(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (it) =>
        (it.cliente_nome || "").toLowerCase().includes(needle) ||
        (it.codigo_pedido || "").includes(needle) ||
        (it.cidade || "").toLowerCase().includes(needle),
    );
  }, [items, q]);

  const kpis = useMemo(() => {
    const valor = visible.reduce((s, i) => s + (i.valor_total || 0), 0);
    const rec = visible.filter((i) => i.situacao === "Recuperado").length;
    return { n: visible.length, valor, carteira: visible.length - rec, rec };
  }, [visible]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={sync}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar com base
        </button>
        <div className="flex overflow-hidden rounded-xl bg-night text-white">
          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Código ERP"
            className="w-36 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
            onKeyDown={(e) => e.key === "Enter" && consultar()}
          />
          <button
            type="button"
            onClick={consultar}
            disabled={asking}
            className="inline-flex items-center gap-1 bg-slate-800 px-3 text-xs font-extrabold"
          >
            <PackageSearch className="h-3.5 w-3.5" />
            Consultar ERP
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips().map((c) => (
          <button
            key={c.iso}
            type="button"
            onClick={() => setDia(c.iso)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-extrabold",
              dia === c.iso ? "bg-night text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {c.label}
          </button>
        ))}
        {role === "adm" && <CollaboratorFilter value={vendedor} onChange={setVendedor} team={team} />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi n={String(kpis.n)} label="Pedidos" />
        <Kpi n={formatMoney(kpis.valor)} label="Faturamento" green />
        <Kpi n={String(kpis.carteira)} label="Da carteira" sky />
        <Kpi n={String(kpis.rec)} label="Recuperados" rose />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por código ERP ou cliente…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-avinor/40"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Da carteira
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Recuperado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Incompleto
        </span>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-card">
        <table className="w-full min-w-[1020px] text-left text-sm">
          <thead className="bg-slate-900 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
            <tr>
              <th className="px-5 py-3">Código ERP</th>
              <th className="px-3 py-3">Cliente</th>
              <th className="px-3 py-3">Cidade</th>
              <th className="px-3 py-3">Situação</th>
              <th className="px-3 py-3">Valor</th>
              <th className="px-3 py-3">Itens</th>
              <th className="px-3 py-3">Fechado por</th>
              <th className="px-3 py-3">Horário</th>
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((it) => {
              const expanded = open === it.id;
              const rec = it.situacao === "Recuperado";
              return (
                <Fragment key={it.id}>
                  <tr
                    className={cn(
                      "cursor-pointer border-l-4 transition",
                      rec
                        ? "border-l-rose-500 bg-rose-50/50 hover:bg-rose-50"
                        : "border-l-sky-500 bg-sky-50/50 hover:bg-sky-50",
                      expanded && (rec ? "bg-rose-100/70" : "bg-sky-100/70"),
                    )}
                    onClick={() => setOpen(expanded ? null : it.id)}
                  >
                    <td className="px-5 py-3 font-mono text-xs font-extrabold text-slate-700">
                      {it.codigo_pedido || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-extrabold text-slate-900">{it.cliente_nome}</p>
                    </td>
                    <td className="px-3 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                      {it.cidade || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                          rec ? "bg-rose-500 text-white" : "bg-sky-500 text-white",
                        )}
                      >
                        {it.situacao}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-black text-slate-900">{formatMoney(it.valor_total)}</p>
                      {!it.synced && <p className="text-[10px] font-extrabold text-amber-700">Incompleto</p>}
                    </td>
                    <td className="px-3 py-3 text-xs font-bold text-slate-500">{it.itens?.length || "—"}</td>
                    <td className="px-3 py-3 text-xs font-extrabold text-slate-600">{it.vendedor_nome || it.created_by}</td>
                    <td className="px-3 py-3 text-xs font-bold text-slate-500">
                      {formatTime(it.created_at)}
                      {it.updated_at ? ` → ${formatTime(it.updated_at)}` : ""}
                    </td>
                    <td className="px-3 py-3">
                      <ChevronDown className={cn("h-4 w-4 text-slate-400 transition", expanded && "rotate-180")} />
                    </td>
                  </tr>
                  {expanded && (
                    <tr className={cn("border-l-4", rec ? "border-l-rose-500 bg-rose-50" : "border-l-sky-500 bg-sky-50")}>
                      <td colSpan={9} className="px-5 pb-4 pt-0">
                        <div
                          className={cn(
                            "rounded-2xl border bg-white p-4 shadow-sm",
                            rec ? "border-rose-100" : "border-sky-100",
                          )}
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <p
                              className={cn(
                                "text-[11px] font-extrabold uppercase tracking-wide",
                                rec ? "text-rose-500" : "text-sky-600",
                              )}
                            >
                              Itens do pedido
                            </p>
                            <p className="text-[11px] font-bold text-slate-400">
                              {it.itens?.length || 0} SKU · {formatMoney(it.valor_total)}
                            </p>
                          </div>
                          {it.itens?.length ? (
                            <ul className="overflow-hidden rounded-xl border border-slate-100">
                              {it.itens.map((p, i) => (
                                <li
                                  key={i}
                                  className={cn(
                                    "flex items-center justify-between gap-3 px-3 py-2.5",
                                    i % 2 === 0 ? "bg-white" : "bg-slate-50",
                                  )}
                                >
                                  <div className="min-w-0">
                                    {p.produto && (
                                      <p className="text-[10px] font-extrabold uppercase tracking-wide text-orange-500">
                                        {p.produto}
                                      </p>
                                    )}
                                    <p className="truncate font-extrabold text-slate-900">{p.descricao}</p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-[11px] font-bold text-slate-400">{p.qtd ?? "—"} un.</p>
                                    <p className="font-black text-emerald-600">{formatMoney(p.valor)}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm font-medium text-amber-800">
                              Sem itens ainda. Clique em Atualizar com base depois que o pedido entrar no EXTRACTOR.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center text-sm text-slate-500">
                  Nenhum finalizado em {formatDate(dia)}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {popup && <PedidoPopup data={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}

function Kpi({ n, label, green, rose, sky }: { n: string; label: string; green?: boolean; rose?: boolean; sky?: boolean }) {
  return (
    <article
      className={cn(
        "rounded-3xl border px-5 py-4 shadow-card",
        rose ? "border-rose-100 bg-rose-50/70" : sky ? "border-sky-100 bg-sky-50/70" : "border-slate-100 bg-white",
      )}
    >
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-3xl font-black",
          green ? "text-emerald-600" : rose ? "text-rose-600" : sky ? "text-sky-700" : "text-slate-900",
        )}
      >
        {n}
      </p>
    </article>
  );
}
