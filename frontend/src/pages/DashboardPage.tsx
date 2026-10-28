import {
  ArrowUpRight,
  CircleCheck,
  MapPinned,
  PhoneCall,
  PieChart,
  Siren,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { CollaboratorFilter } from "../components/CollaboratorFilter";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { COLOR_BAR, COLOR_DOT } from "../lib/status";
import type { Colaboradora } from "../lib/types";
import { cn, formatDate } from "../lib/utils";

type DashSlice = {
  kpis: {
    clientes_dia: number;
    em_atendimento: number;
    atendidos: number;
    em_recuperacao: number;
    carteira?: number;
  };
  bars: { id: string; label: string; color: string; count: number; pct: number }[];
  routes: { id: string; nome: string; clientes: number }[];
};

type Dash = DashSlice & {
  date: string;
  colaboradoras?: Colaboradora[];
  por_colaboradora?: Record<string, DashSlice>;
};

export function DashboardPage() {
  const { role } = useAuth();
  const [full, setFull] = useState<Dash | null>(null);
  const [err, setErr] = useState("");
  const [vendedor, setVendedor] = useState("todas");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api<Dash>("/api/clients/dashboard")
      .then((d) => {
        if (live) setFull(d);
      })
      .catch((e: Error) => {
        if (live) setErr(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const data = useMemo(() => {
    if (!full) return null;
    if (vendedor === "todas") return full;
    const slice = full.por_colaboradora?.[vendedor];
    return slice ? { ...full, ...slice } : full;
  }, [full, vendedor]);

  if (err) return <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{err}</p>;

  const k = data?.kpis;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CollaboratorFilter
          value={vendedor}
          onChange={setVendedor}
          team={full?.colaboradoras}
          busy={loading}
        />
        {k?.carteira ? (
          <p className="text-sm font-extrabold text-slate-500">
            {k.carteira} clientes na carteira
          </p>
        ) : null}
      </div>
      {!data || !k ? (
        <DashboardSkeleton />
      ) : (
      <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          to="/clientes-do-dia"
          n={k.clientes_dia}
          label="Clientes do Dia"
          hint="rota de hoje + extras"
          icon={UsersRound}
          iconClass="bg-avinor text-white"
        />
        <Kpi
          to="/clientes-do-dia?status=em_atendimento"
          n={k.em_atendimento}
          label="Em Atendimento"
          hint="agora"
          icon={PhoneCall}
          iconClass="bg-amber-400 text-white"
        />
        <Kpi
          to="/clientes-do-dia?status=atendido"
          n={k.atendidos}
          label="Atendidos / Concluídos"
          hint="hoje"
          icon={CircleCheck}
          iconClass="bg-emerald-500 text-white"
        />
        <Kpi
          to="/clientes-recuperacao"
          n={k.em_recuperacao}
          label="Em Recuperação"
          hint="janela de hoje · até 30"
          icon={TriangleAlert}
          iconClass="bg-rose-500 text-white"
          danger
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-extrabold text-slate-900">Status dos atendimentos de hoje</h2>
              <p className="text-sm font-medium text-slate-400">Distribuição em tempo real</p>
            </div>
            <Link
              to="/clientes-do-dia"
              className="inline-flex items-center gap-1 text-sm font-bold text-slate-400 transition hover:text-avinor"
            >
              Ver detalhes <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {data.bars.map((b) => (
              <Link
                key={b.id}
                to={`/clientes-do-dia?status=${encodeURIComponent(b.id)}`}
                className="block rounded-2xl px-2 py-2 transition hover:bg-slate-50"
              >
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <span className={cn("h-2.5 w-2.5 rounded-full", COLOR_DOT[b.color] || COLOR_DOT.slate)} />
                    {b.label}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {b.count}/{k.clientes_dia || 0} · {b.pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${COLOR_BAR[b.color] || "bg-slate-400"}`}
                    style={{ width: `${Math.max(b.pct, b.count ? 6 : 0)}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section className="rounded-3xl bg-gradient-to-br from-[#1b2437] via-[#141b2d] to-[#2a1a16] p-6 text-white shadow-card">
          <p className="text-xs font-bold tracking-wide text-slate-300">Hoje · {formatDate(data.date)}</p>
          <h2 className="mt-3 font-display text-2xl font-extrabold">Rota do dia</h2>
          <p className="mt-1 text-xs font-medium text-slate-400">Quem entra em contato hoje (Enviar cards)</p>
          <ul className="mt-6 space-y-2.5">
            {data.routes.length === 0 && (
              <li className="text-sm text-slate-400">Nenhuma rota com card para hoje.</li>
            )}
            {data.routes.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/clientes-do-dia?rota=${encodeURIComponent(r.id)}`}
                  className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2.5 transition hover:bg-white/10"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                    {r.nome}
                  </span>
                  <span className="text-xs font-bold text-slate-300">{r.clientes} clientes</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/rotas"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-avinor px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-avinor/30 transition hover:-translate-y-0.5 hover:bg-avinor-600"
          >
            Ver todas as rotas <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
        <h3 className="mb-3 font-display text-lg font-extrabold text-slate-900">Ações rápidas</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Quick to="/rotas" icon={MapPinned} label="Visualizar rotas da semana" tone="bg-orange-50 text-orange-600" />
          <Quick
            to="/clientes-recuperacao"
            icon={Siren}
            label="Clientes em recuperação"
            tone="bg-rose-50 text-rose-600"
          />
          {role === "adm" ? (
            <Quick to="/relatorios" icon={PieChart} label="Painel avaliativo do ADM" tone="bg-emerald-50 text-emerald-700" />
          ) : (
            <Quick to="/finalizados" icon={CircleCheck} label="Ver finalizados do dia" tone="bg-emerald-50 text-emerald-700" />
          )}
        </div>
      </section>
      </>
      )}
    </div>
  );
}

function Kpi({
  to,
  n,
  label,
  hint,
  icon: Icon,
  iconClass,
  danger,
}: {
  to: string;
  n: number;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  danger?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group relative overflow-hidden rounded-3xl border bg-white p-5 shadow-card transition duration-200",
        "hover:-translate-y-1 hover:shadow-lift",
        danger ? "border-rose-100 bg-rose-50/80" : "border-slate-100 hover:border-avinor/20",
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn("grid h-11 w-11 place-items-center rounded-2xl shadow-sm", iconClass)}>
          <Icon className="h-5 w-5" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-avinor" />
      </div>
      <p className={cn("mt-4 font-display text-4xl font-black tabular-nums tracking-tight", danger ? "text-rose-600" : "text-slate-900")}>
        {n}
      </p>
      <p className="mt-1 text-sm font-extrabold text-slate-700">{label}</p>
      <p className={cn("text-xs font-bold", danger ? "text-rose-500" : "text-slate-400")}>{hint}</p>
    </Link>
  );
}

function Quick({
  to,
  icon: Icon,
  label,
  tone,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3.5 text-sm font-extrabold text-slate-700 transition hover:-translate-y-0.5 hover:border-avinor/20 hover:bg-slate-50 hover:shadow-card"
    >
      <span className={cn("grid h-10 w-10 place-items-center rounded-xl", tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">{label}</span>
      <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-avinor" />
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-3xl bg-white shadow-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="h-72 animate-pulse rounded-3xl bg-white shadow-card" />
        <div className="h-72 animate-pulse rounded-3xl bg-slate-800" />
      </div>
    </div>
  );
}
