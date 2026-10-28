import { CheckCircle2, MapPin, Phone, PhoneOff, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CollaboratorFilter } from "../components/CollaboratorFilter";
import { FinalizeModal } from "../components/FinalizeModal";
import { MotivoModal } from "../components/MotivoModal";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDemo } from "../lib/demo";
import { MOCK_RECOVERY } from "../lib/mockData";
import type { Client, Colaboradora } from "../lib/types";
import { cn, formatPhone } from "../lib/utils";

const GIRL_BY_ID: Record<number, string> = { 1071: "Poliana", 1072: "Fernanda", 1073: "Karolline" };

type Payload = {
  total: number;
  pool?: number;
  niveis?: Record<string, number>;
  colaboradoras?: Colaboradora[];
  items: Client[];
};

const COLS: {
  id: "31_60" | "61_90" | "90_mais";
  label: string;
  hint: string;
  tone: string;
  badge: string;
  num: string;
}[] = [
  {
    id: "31_60",
    label: "31 – 60 dias",
    hint: "Alerta inicial. Pega até 10. Se faltar, usa o próximo nível.",
    tone: "from-amber-50 to-white border-amber-100",
    badge: "bg-amber-100 text-amber-700",
    num: "text-amber-500",
  },
  {
    id: "61_90",
    label: "61 – 90 dias",
    hint: "Risco médio. Pega até 10. Se faltar, usa o próximo nível.",
    tone: "from-orange-50 to-white border-orange-100",
    badge: "bg-orange-100 text-orange-700",
    num: "text-orange-500",
  },
  {
    id: "90_mais",
    label: "90+ dias",
    hint: "Crítico. Pega até 10. Completa o teto de 30 da janela.",
    tone: "from-rose-50 to-white border-rose-100",
    badge: "bg-rose-100 text-rose-600",
    num: "text-rose-500",
  },
];

export function RecuperacaoPage() {
  const { user, role } = useAuth();
  const { mock, closes, recordClose } = useDemo();
  const [data, setData] = useState<Payload | null>(null);
  const [q, setQ] = useState("");
  const [vendedor, setVendedor] = useState("todas");
  const [finalizeFor, setFinalizeFor] = useState<Client | null>(null);
  const [motivoFor, setMotivoFor] = useState<Client | null>(null);

  const scopeId = role === "colaborador" ? user?.vendedor_id ?? null : vendedor === "todas" ? null : Number(vendedor);

  const load = () => {
    if (mock) return;
    const params = new URLSearchParams({ q, page: "1", page_size: "50", faixa: "todas" });
    if (scopeId) params.set("vendedor", String(scopeId));
    api<Payload>(`/api/clients/recovery?${params}`)
      .then(setData)
      .catch((e: Error) => toast.error(e.message));
  };

  useEffect(() => {
    if (mock) {
      const filtered = MOCK_RECOVERY.filter((c) => {
        if (scopeId && c.assigned_vendedor_id !== scopeId && c.assigned_vendedor_nome !== GIRL_BY_ID[scopeId]) {
          return false;
        }
        if (q.trim() && !`${c.nome} ${c.cidade} ${c.endereco}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }).map((c) => {
        const demo = closes[c.id];
        return demo ? { ...c, close_kind: demo.kind } : c;
      });
      const niveis = { "31_60": 0, "61_90": 0, "90_mais": 0 };
      for (const c of filtered) niveis[c.nivel || "90_mais"] += 1;
      setData({
        total: filtered.length,
        pool: filtered.length,
        niveis,
        colaboradoras: [
          { id: 1071, nome: "Poliana", login: "poliana" },
          { id: 1072, nome: "Fernanda", login: "fernanda" },
          { id: 1073, nome: "Karolline", login: "karolline" },
        ],
        items: filtered,
      });
      return;
    }
    setData(null);
    load();
  }, [q, vendedor, mock, scopeId, closes]);

  const markNaoAtend = async (c: Client) => {
    if (mock) {
      recordClose({
        cliente_id: c.id,
        cliente_nome: c.nome,
        kind: "nao_atendido",
        origem: "recuperacao",
        cidade: c.cidade,
        at: new Date().toISOString(),
      });
      toast.success("Não atendeu — só na demonstração.");
      return;
    }
    try {
      await api(`/api/clients/${c.id}/close`, {
        method: "POST",
        body: JSON.stringify({ kind: "nao_atendido", motivo: "Não atendeu", origem: "recuperacao" }),
      });
      toast.success("Marcado como não atendido hoje.");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const confirmMotivo = async (motivo: string) => {
    if (!motivoFor) return;
    if (mock) {
      recordClose({
        cliente_id: motivoFor.id,
        cliente_nome: motivoFor.nome,
        kind: "nao_recuperado",
        motivo,
        origem: "recuperacao",
        cidade: motivoFor.cidade,
        at: new Date().toISOString(),
      });
      toast.success("Não recuperado — só na demonstração.");
      setMotivoFor(null);
      return;
    }
    try {
      await api(`/api/clients/${motivoFor.id}/close`, {
        method: "POST",
        body: JSON.stringify({ kind: "nao_recuperado", motivo, origem: "recuperacao" }),
      });
      toast.success("Não recuperado registrado.");
      setMotivoFor(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, Client[]> = { "31_60": [], "61_90": [], "90_mais": [] };
    for (const c of data?.items || []) {
      g[c.nivel || "90_mais"]?.push(c);
    }
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => (a.dias_sem_contato || 0) - (b.dias_sem_contato || 0));
    }
    return g;
  }, [data]);

  const niveis = data?.niveis || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CollaboratorFilter value={vendedor} onChange={setVendedor} team={data?.colaboradoras} />
        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-600 ring-1 ring-rose-100">
          {role === "colaborador"
            ? `Sua fila · ${data?.pool || 0} cliente(s) · menor tempo parado primeiro`
            : `Prioridade: menor tempo parado primeiro · ${data?.pool || 0} na fila`}
        </span>
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
        <h3 className="font-display text-lg font-extrabold text-slate-900">Como a fila é montada</h3>
        <p className="mb-4 text-sm text-slate-400">
          {role === "colaborador"
            ? "Os 30 da janela são divididos entre as três. Aqui só entram os seus — cada um cai na coluna do tempo parado."
            : "Extra da rota de hoje. Não é a carteira. Teto 30, ~10 para cada uma, começando pelos 31–60."}
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {COLS.map((col, i) => (
            <article key={col.id} className={cn("rounded-2xl border bg-gradient-to-br p-4", col.tone)}>
              <div className="flex items-center justify-between">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", col.badge)}>
                  #{i + 1} {col.label}
                </span>
                <span className="text-xs font-extrabold text-slate-400">
                  {role === "adm" && vendedor === "todas" ? `${niveis[col.id] || 0}/10` : niveis[col.id] || 0}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium leading-snug text-slate-500">{col.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, cidade, end."
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-avinor/40"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {COLS.map((col) => (
          <section key={col.id} className={cn("rounded-3xl border bg-gradient-to-b p-4 shadow-card", col.tone)}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h3 className="font-display text-xl font-black text-slate-900">{col.label}</h3>
                <p className="text-xs font-bold text-slate-400">{grouped[col.id].length} na fila</p>
              </div>
              <p className={cn("font-display text-4xl font-black tabular-nums", col.num)}>{grouped[col.id].length}</p>
            </div>
            <ul className="space-y-2.5">
              {grouped[col.id].map((c) => (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-2xl border border-white/80 bg-white p-3 shadow-sm",
                    c.close_kind && "opacity-55",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-slate-900">{c.nome}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-slate-400">
                        <MapPin className="h-3 w-3 text-orange-400" />
                        {c.cidade || "—"} · {c.rota_nome || "—"}
                        {role === "adm" && c.assigned_vendedor_nome ? ` · ${c.assigned_vendedor_nome}` : ""}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="h-3 w-3" />
                        {formatPhone(c.telefone)}
                      </p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black", col.badge)}>
                      {c.dias_sem_contato}d
                    </span>
                  </div>
                  {c.close_kind ? (
                    <p className="mt-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                      {c.close_kind === "finalizado"
                        ? "Recuperado"
                        : c.close_kind === "nao_recuperado"
                          ? "Não recuperado"
                          : "Não atendido hoje"}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFinalizeFor(c)}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 hover:bg-emerald-100"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Recuperado
                      </button>
                      <button
                        type="button"
                        onClick={() => setMotivoFor(c)}
                        className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-600 hover:bg-rose-100"
                      >
                        <X className="h-3 w-3" />
                        Não recup.
                      </button>
                      <button
                        type="button"
                        onClick={() => markNaoAtend(c)}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-extrabold text-slate-500 hover:bg-slate-100"
                      >
                        <PhoneOff className="h-3 w-3" />
                        N/atend.
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {grouped[col.id].length === 0 && (
                <li className="rounded-2xl bg-white/70 px-3 py-8 text-center text-sm text-slate-400">Ninguém neste nível hoje.</li>
              )}
            </ul>
          </section>
        ))}
      </div>
      {finalizeFor && (
        <FinalizeModal
          clienteId={finalizeFor.id}
          clienteNome={finalizeFor.nome}
          origem="recuperacao"
          simulate={mock}
          onCancel={() => setFinalizeFor(null)}
          onDone={(extra) => {
            if (mock) {
              recordClose({
                cliente_id: finalizeFor.id,
                cliente_nome: finalizeFor.nome,
                kind: "finalizado",
                codigo: extra?.codigo,
                valor: extra?.valor,
                origem: "recuperacao",
                cidade: finalizeFor.cidade,
                at: new Date().toISOString(),
              });
            }
            setFinalizeFor(null);
            if (!mock) load();
          }}
        />
      )}
      {motivoFor && (
        <MotivoModal
          title="Não recuperado"
          hint="Descreva o motivo — entra nos relatórios do ADM por cidade."
          onCancel={() => setMotivoFor(null)}
          onConfirm={confirmMotivo}
        />
      )}
    </div>
  );
}
