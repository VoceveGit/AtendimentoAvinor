import { Flame, MapPinned, ShoppingBag, Trophy } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useDemo } from "../lib/demo";
import { MOCK_ANALYTICS } from "../lib/mockData";
import { cn, formatDate, formatDuration, formatMoney } from "../lib/utils";

export type Evento = {
  id: number;
  cliente_nome?: string | null;
  cidade?: string | null;
  rota_nome?: string | null;
  vendedor_id?: number | null;
  vendedor_nome?: string | null;
  kind: string;
  motivo?: string | null;
  valor_total?: number | null;
  origem?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

const HEAT_KEY = "avinor_heat_cell";

function readHeatPick(): { d: number; h: number } | null {
  try {
    const raw = localStorage.getItem(HEAT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { d: number; h: number };
    if (Number.isInteger(v.d) && Number.isInteger(v.h)) return v;
  } catch {
    return null;
  }
  return null;
}

function slotOf(iso?: string | null): { d: number; h: number } | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  const js = dt.getDay();
  if (js === 0) return null;
  const d = js - 1;
  if (d > 5) return null;
  const h = dt.getHours();
  if (h < 8 || h > 17) return null;
  return { d, h: h - 8 };
}

function squares100(items: { motivo: string; n: number }[]) {
  const total = items.reduce((s, i) => s + i.n, 0);
  if (!total) return [] as { motivo: string; color: string }[];
  const rows = items.map((i, idx) => {
    const exact = (i.n / total) * 100;
    return { ...i, color: LOSS_COLORS[idx % LOSS_COLORS.length], exact, sq: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let left = 100 - rows.reduce((s, r) => s + r.sq, 0);
  [...rows].sort((a, b) => b.frac - a.frac).forEach((r) => {
    if (left <= 0) return;
    r.sq += 1;
    left -= 1;
  });
  return rows.flatMap((r) => Array.from({ length: r.sq }, () => ({ motivo: r.motivo, color: r.color })));
}

type Data = {
  start: string;
  end: string;
  kpis: {
    fluxo_hoje: number;
    finalizados: number;
    nao_venda: number;
    nao_recuperado: number;
    nao_atendidos_hoje: number;
    conversao: number;
    valor: number;
    ticket: number;
    pedidos: number;
    recuperados: number;
    cobertura: number;
    encerrados: number;
    cadastros?: number;
  };
  colaboradoras: {
    id: number;
    nome: string;
    finalizado: number;
    valor: number;
    recuperados: number;
    nao_venda: number;
    conversao?: number;
  }[];
  cidades: { cidade: string; finalizado: number; nao_venda: number; valor: number }[];
  produtos: { nome: string; qtd: number; valor: number }[];
  produtos_cidade: { cidade: string; nome: string; qtd: number; valor: number }[];
  motivos: { cidade: string; motivo: string; n: number }[];
  motivos_nuvem?: { motivo: string; n: number }[];
  dias: { dia: string; finalizado: number; nao_venda: number; valor: number }[];
  pico_finalizacao: string | null;
  heatmap?: number[][];
  recuperacao_faixa?: Record<string, number>;
  eventos?: Evento[];
};

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = ["8h", "9h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h"];
const CITY_TONE = [
  { bubble: "bg-orange-500", bar: "bg-orange-400", text: "text-orange-600" },
  { bubble: "bg-amber-400", bar: "bg-amber-400", text: "text-amber-600" },
  { bubble: "bg-emerald-500", bar: "bg-emerald-400", text: "text-emerald-600" },
  { bubble: "bg-sky-500", bar: "bg-sky-400", text: "text-sky-600" },
  { bubble: "bg-violet-500", bar: "bg-violet-400", text: "text-violet-600" },
];
const LOSS_COLORS = ["#e11d48", "#f97316", "#f59e0b", "#fbbf24", "#78716c", "#38bdf8"];

type RangeKey = "hoje" | "7" | "30" | "custom";

function isoDaysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function weekday(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."][d.getDay()];
}

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function moneyInt(n?: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function RelatoriosPage() {
  const { mock } = useDemo();
  const today = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState<RangeKey>("30");
  const [start, setStart] = useState(isoDaysAgo(29));
  const [end, setEnd] = useState(today);
  const [data, setData] = useState<Data | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [heatHover, setHeatHover] = useState<{ d: number; h: number } | null>(null);
  const [heatPick, setHeatPick] = useState<{ d: number; h: number } | null>(readHeatPick);
  const [hoverMotivo, setHoverMotivo] = useState<string | null>(null);
  const [motivoPick, setMotivoPick] = useState<string | null>(null);
  const [colabPick, setColabPick] = useState<number | null>(null);

  const applyRange = (key: RangeKey) => {
    setRange(key);
    if (key === "hoje") {
      setStart(today);
      setEnd(today);
    } else if (key === "7") {
      setStart(isoDaysAgo(6));
      setEnd(today);
    } else if (key === "30") {
      setStart(isoDaysAgo(29));
      setEnd(today);
    }
  };

  useEffect(() => {
    setCity(null);
    if (mock) {
      setData(MOCK_ANALYTICS as Data);
      return;
    }
    setData(null);
    api<Data>(`/api/analytics?start=${start}&end=${end}`)
      .then(setData)
      .catch((e: Error) => toast.error(e.message));
  }, [start, end, mock]);

  const nuvem = useMemo(() => {
    if (!data) return [];
    const losses = (data.eventos || []).filter((e) => e.kind === "nao_venda" || e.kind === "nao_recuperado");
    if (losses.length) {
      const acc: Record<string, { motivo: string; n: number }> = {};
      for (const e of losses) {
        const motivo = (e.motivo || "Sem motivo").trim() || "Sem motivo";
        acc[motivo] = acc[motivo] || { motivo, n: 0 };
        acc[motivo].n += 1;
      }
      return Object.values(acc).sort((a, b) => b.n - a.n);
    }
    if (data.motivos_nuvem?.length) return data.motivos_nuvem;
    return Object.values(
      (data.motivos || []).reduce((acc: Record<string, { motivo: string; n: number }>, m) => {
        acc[m.motivo] = acc[m.motivo] || { motivo: m.motivo, n: 0 };
        acc[m.motivo].n += m.n;
        return acc;
      }, {}),
    );
  }, [data]);

  if (!data) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-3xl bg-white shadow-card" />
        ))}
      </div>
    );
  }

  const k = data.kpis;
  const enc = Math.max(k.encerrados, k.finalizados + k.nao_venda + k.nao_recuperado);
  const vendas = k.finalizados;
  const perdas = k.nao_venda;
  const recNo = k.nao_recuperado;
  const conv = k.conversao || 0;
  const prodSource = city
    ? (data.produtos_cidade || [])
        .filter((p) => p.cidade === city)
        .map((p) => ({ nome: p.nome, qtd: p.qtd, valor: p.valor }))
    : data.produtos;
  const produtos = [...prodSource].sort((a, b) => b.valor - a.valor);
  const fatProd = Math.max(1, produtos.reduce((s, p) => s + p.valor, 0));
  const fatCity = Math.max(1, data.cidades.reduce((s, c) => s + c.valor, 0));
  const maxCity = Math.max(1, ...data.cidades.map((c) => c.valor));
  const maxProd = Math.max(1, ...produtos.map((p) => p.valor));
  const maxDay = Math.max(1, ...data.dias.map((d) => d.finalizado));
  const maxLoss = Math.max(1, ...data.dias.map((d) => d.nao_venda || 0));
  const eventos = data.eventos || [];
  const heat = data.heatmap || [];
  const maxHeat = Math.max(1, ...heat.flat());
  const faixa = data.recuperacao_faixa || {};
  const totalNuvem = nuvem.reduce((s, m) => s + m.n, 0);
  const activeHeat = heatPick || heatHover;
  const heatCount = activeHeat ? heat[activeHeat.d]?.[activeHeat.h] || 0 : 0;
  const heatSales = heatPick
    ? eventos.filter((e) => {
        const s = slotOf(e.created_at);
        return s && s.d === heatPick.d && s.h === heatPick.h && e.kind === "finalizado";
      })
    : [];
  const lossEventos = eventos.filter((e) => e.kind === "nao_venda" || e.kind === "nao_recuperado");
  const motivoRows = motivoPick ? lossEventos.filter((e) => (e.motivo || "Sem motivo") === motivoPick) : [];
  const colabRows = colabPick
    ? eventos.filter((e) => e.vendedor_id === colabPick && e.kind === "finalizado")
    : [];
  const waffle = squares100(nuvem);
  const pickHeat = (d: number, h: number) => {
    const same = heatPick?.d === d && heatPick?.h === h;
    const next = same ? null : { d, h };
    setHeatPick(next);
    if (next) localStorage.setItem(HEAT_KEY, JSON.stringify(next));
    else localStorage.removeItem(HEAT_KEY);
  };
  const pico = data.dias.reduce(
    (best, d) => (d.finalizado > (best?.finalizado || 0) ? d : best),
    data.dias[0] || null,
  );
  const hover = hoverDay ? data.dias.find((d) => d.dia === hoverDay) : null;
  const tip = hover || pico;
  const bestHour = (() => {
    if (!heat.length) return null;
    let hi = 0;
    let best = -1;
    for (let h = 0; h < HOURS.length; h++) {
      const sum = heat.reduce((s, row) => s + (row[h] || 0), 0);
      if (sum > best) {
        best = sum;
        hi = h;
      }
    }
    return HOURS[hi];
  })();
  const ranked = [...data.colaboradoras].sort((a, b) => b.finalizado - a.finalizado);
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
  const colabNome = ranked.find((c) => c.id === colabPick)?.nome;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm font-medium text-slate-400">
          {formatDate(start)} a {formatDate(end)}
          {mock ? " · demonstração preenchida" : " · o que o painel fechou"}
        </p>
        <div className="flex flex-wrap items-center gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200">
          {(
            [
              ["hoje", "Hoje"],
              ["7", "7 dias"],
              ["30", "30 dias"],
              ["custom", "Personalizado"],
            ] as [RangeKey, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyRange(id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-extrabold",
                range === id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {range === "custom" && (
        <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="outline-none" />
          <span className="font-bold text-slate-300">a</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="outline-none" />
        </label>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-card">
          <p className="text-sm font-bold text-slate-400">Atendimentos encerrados</p>
          <div className="mt-1 flex items-start justify-between gap-4">
            <p className="font-display text-6xl font-black tracking-tight text-slate-900">{enc}</p>
            <Donut pct={conv} />
          </div>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-extrabold text-orange-700">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            {k.nao_atendidos_hoje} {k.nao_atendidos_hoje === 1 ? "marcado" : "marcados"} para falar hoje
          </span>
          <div className="mt-5 flex h-8 overflow-hidden rounded-full">
            <div className="bg-emerald-500" style={{ width: `${(vendas / Math.max(enc, 1)) * 100}%` }} title={`${vendas} vendas`} />
            <div className="bg-rose-500" style={{ width: `${(perdas / Math.max(enc, 1)) * 100}%` }} />
            <div className="bg-stone-400" style={{ width: `${(recNo / Math.max(enc, 1)) * 100}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
            <Legend n={vendas} pct={conv} label="Viraram venda" color="bg-emerald-500" />
            <Legend n={perdas} pct={enc ? Math.round((perdas / enc) * 1000) / 10 : 0} label="Não realizadas" color="bg-rose-500" />
            <Legend n={recNo} pct={enc ? Math.round((recNo / enc) * 1000) / 10 : 0} label="Não recuperados" color="bg-stone-400" />
          </div>
        </section>

        <section className="rounded-3xl bg-gradient-to-br from-[#2a140c] via-[#1a0f0c] to-[#3d1c0e] p-6 text-white shadow-card">
          <p className="text-sm font-bold text-orange-200/80">Valor vendido</p>
          <p className="mt-1 font-display text-5xl font-black tracking-tight">{moneyInt(k.valor)}</p>
          <p className="mt-1 text-sm font-bold text-orange-200/70">
            ↗ {k.pedidos} pedidos · ticket médio {formatMoney(k.ticket)}
          </p>
          <Spark values={data.dias.map((d) => d.valor)} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/25 p-4">
              <p className="text-xs font-bold text-orange-200/70">Clientes cobertos</p>
              <p className="mt-1 font-display text-3xl font-black">{k.cobertura}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(100, (k.cobertura / Math.max(enc, 1)) * 100)}%` }} />
              </div>
              <p className="mt-2 text-[11px] font-bold text-orange-200/50">de {enc} encerrados</p>
            </div>
            <div className="rounded-2xl bg-black/25 p-4">
              <p className="text-xs font-bold text-orange-200/70">Cadastros / recuperados</p>
              <p className="mt-1 font-display text-3xl font-black">{k.cadastros ?? k.recuperados}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(100, ((k.cadastros ?? k.recuperados) / Math.max(k.cobertura, 1)) * 100)}%` }} />
              </div>
              <p className="mt-2 text-[11px] font-bold text-orange-200/50">novos na base</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Onde vendemos" subtitle="Bolha = pedidos · barra = faturamento. Clique para filtrar os produtos.">
          {data.cidades.length === 0 && <Empty />}
          {data.cidades.map((c, i) => {
            const tone = CITY_TONE[i % CITY_TONE.length];
            const ticket = c.finalizado ? c.valor / c.finalizado : 0;
            const share = Math.round((c.valor / fatCity) * 100);
            return (
              <button
                key={c.cidade}
                type="button"
                onClick={() => setCity((cur) => (cur === c.cidade ? null : c.cidade))}
                className={cn("mb-3 flex w-full items-center gap-3 rounded-2xl p-1.5 text-left", city === c.cidade && "bg-orange-50")}
              >
                <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-black text-white", tone.bubble)}>
                  {c.finalizado}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 truncate font-extrabold text-slate-800">
                      <MapPinned className={cn("h-3.5 w-3.5", tone.text)} />
                      {c.cidade}
                    </span>
                    <span className="shrink-0 text-sm font-black text-slate-800">{moneyInt(c.valor)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${Math.max(8, (c.valor / maxCity) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">
                    {share}% do faturamento · {formatMoney(ticket)} por pedido
                  </p>
                </div>
              </button>
            );
          })}
        </Card>

        <Card
          title="O que vendemos"
          subtitle={city ? `Filtro: ${city} · ${moneyInt(fatProd)}` : `Faturamento por produto · total ${moneyInt(fatProd)}`}
        >
          {produtos.length === 0 && <Empty text="Quando os pedidos sincronizarem, o mix aparece aqui." />}
          {produtos.map((p, i) => {
            const pct = Math.round((p.valor / fatProd) * 100);
            return (
              <div key={p.nome} className="mb-4">
                <div className="mb-1 flex items-end justify-between gap-3 text-sm">
                  <span className="truncate font-extrabold text-slate-800">
                    <span className="mr-2 text-slate-300">{String(i + 1).padStart(2, "0")}</span>
                    {p.nome}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-slate-500">
                    {formatMoney(p.valor)} · {Math.round(p.qtd)} un
                  </span>
                </div>
                <div className="relative h-7 overflow-hidden rounded-full bg-orange-50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-300 to-avinor"
                    style={{ width: `${Math.max(12, (p.valor / maxProd) * 100)}%` }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-orange-800/80">{pct}%</span>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card
          title="Ritmo diário"
          subtitle="Vendas para cima, perdas para baixo. Passe o mouse."
          extra={
            tip ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700">
                {hover ? weekday(tip.dia) : "Dia de pico"} · {shortDate(tip.dia)} ·{" "}
                <span className="text-emerald-600">{tip.finalizado} vendas</span>
                {" · "}
                <span className="text-rose-500">{tip.nao_venda || 0} perdas</span>
                {" · "}
                {moneyInt(tip.valor)}
              </span>
            ) : null
          }
        >
          {data.dias.length === 0 && <Empty />}
          <div className="flex h-44" onMouseLeave={() => setHoverDay(null)}>
            {data.dias.map((d) => {
              const active = !hoverDay || hoverDay === d.dia;
              const peak = pico && d.dia === pico.dia;
              return (
                <button
                  key={d.dia}
                  type="button"
                  onMouseEnter={() => setHoverDay(d.dia)}
                  className="flex min-w-0 flex-1 flex-col"
                  title={`${weekday(d.dia)} ${shortDate(d.dia)}`}
                >
                  <div className="flex flex-1 items-end justify-center">
                    <span
                      className={cn(
                        "w-[70%] rounded-t-md transition",
                        !active ? "bg-emerald-100" : peak && !hoverDay ? "bg-orange-400" : "bg-emerald-500",
                      )}
                      style={{ height: `${Math.max(8, (d.finalizado / maxDay) * 100)}%` }}
                    />
                  </div>
                  <div className="flex flex-1 items-start justify-center">
                    <span
                      className={cn("w-[70%] rounded-b-md transition", active ? "bg-rose-400" : "bg-rose-100")}
                      style={{ height: `${Math.max(d.nao_venda ? 8 : 0, ((d.nao_venda || 0) / maxLoss) * 85)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-bold text-slate-400">
            <span>{data.dias[0] ? shortDate(data.dias[0].dia) : ""}</span>
            <span>{data.dias.at(-1) ? shortDate(data.dias.at(-1)!.dia) : ""}</span>
          </div>
        </Card>

        <section className="rounded-3xl bg-gradient-to-br from-[#1c120c] via-[#140e0c] to-[#3a160c] p-6 text-white shadow-card">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-orange-200/70">Recuperação</p>
          <p className="mt-2 font-display text-6xl font-black">{k.recuperados}</p>
          <p className="text-sm font-bold text-orange-100/80">clientes voltaram a comprar</p>
          <DotRow label="Parados há 60–90 dias" n={faixa["60_90"] || 0} color="bg-emerald-400" />
          <DotRow label="Parados há 90–180 dias" n={faixa["90_180"] || 0} color="bg-amber-400" />
          <DotRow label="Parados há 180+ dias" n={faixa["180_mais"] || 0} color="bg-orange-500" />
          <p className="mt-5 text-[11px] font-bold text-orange-200/50">Quanto mais tempo parado, mais difícil trazer de volta.</p>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Quando o cliente atende"
          subtitle={
            activeHeat
              ? `${DAYS[activeHeat.d]} às ${HOURS[activeHeat.h]}: ${heatCount} atendimentos`
              : bestHour
                ? `Melhor horário: ${bestHour} todos os dias`
                : "Volume por hora × dia"
          }
          icon={<Flame className="h-4 w-4 text-orange-500" />}
        >
          {heat.length === 0 && <Empty text="O mapa enche conforme os fechamentos tiverem horário." />}
          {heat.length > 0 && (
            <div onMouseLeave={() => setHeatHover(null)}>
              <div className="mb-1 grid grid-cols-[28px_repeat(10,minmax(0,1fr))] gap-1 text-center text-[10px] font-bold text-slate-400">
                <span />
                {HOURS.map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>
              {heat.map((row, di) => (
                <div key={DAYS[di]} className="mb-1 grid grid-cols-[28px_repeat(10,minmax(0,1fr))] gap-1">
                  <span className="self-center text-[11px] font-extrabold text-slate-500">{DAYS[di]}</span>
                  {row.map((n, hi) => {
                    const picked = heatPick?.d === di && heatPick?.h === hi;
                    const hovered = heatHover?.d === di && heatHover?.h === hi;
                    return (
                      <button
                        key={hi}
                        type="button"
                        onMouseEnter={() => setHeatHover({ d: di, h: hi })}
                        onClick={() => pickHeat(di, hi)}
                        className={cn("h-7 rounded-lg transition", (picked || hovered) && "ring-2 ring-slate-900")}
                        style={{ background: `rgba(234,88,12,${0.12 + (n / maxHeat) * 0.88})` }}
                        aria-label={`${DAYS[di]} ${HOURS[hi]} ${n}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          {heatPick && (
            <MiniList
              title={`Vendas · ${DAYS[heatPick.d]} ${HOURS[heatPick.h]}`}
              empty="Nenhuma venda fechada neste horário no período."
              rows={heatSales.map((e) => ({
                title: e.cliente_nome || "Cliente",
                value: formatMoney(e.valor_total),
                meta: `${e.vendedor_nome || "Atendente"} · ${formatDuration(e.created_at, e.updated_at)}`,
              }))}
            />
          )}
        </Card>

        <Card
          title="Por que perdemos"
          subtitle={
            totalNuvem
              ? `100% das não-vendas · ${totalNuvem} clientes no período`
              : "Motivos das não-vendas no período"
          }
        >
          {waffle.length === 0 && <Empty text="Motivos aparecem quando marcar Não venda / Não recuperado." />}
          <div className="grid grid-cols-10 gap-1">
            {waffle.map((cell, i) => {
              const dim = (hoverMotivo || motivoPick) && (hoverMotivo || motivoPick) !== cell.motivo;
              return (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHoverMotivo(cell.motivo)}
                  onMouseLeave={() => setHoverMotivo(null)}
                  onClick={() => setMotivoPick((cur) => (cur === cell.motivo ? null : cell.motivo))}
                  className={cn("aspect-square rounded-md transition", motivoPick === cell.motivo && "ring-2 ring-slate-900")}
                  style={{ background: cell.color, opacity: dim ? 0.22 : 1 }}
                  title={cell.motivo}
                />
              );
            })}
          </div>
          <ul className="mt-4 space-y-1.5">
            {nuvem.map((m, i) => {
              const on = motivoPick === m.motivo || hoverMotivo === m.motivo;
              return (
                <li key={m.motivo}>
                  <button
                    type="button"
                    className={cn("flex w-full items-center justify-between text-left text-sm", on && "font-black")}
                    onMouseEnter={() => setHoverMotivo(m.motivo)}
                    onMouseLeave={() => setHoverMotivo(null)}
                    onClick={() => setMotivoPick((cur) => (cur === m.motivo ? null : m.motivo))}
                  >
                    <span className="inline-flex items-center gap-2 font-bold text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: LOSS_COLORS[i % LOSS_COLORS.length] }} />
                      {m.motivo}
                    </span>
                    <span className="font-black text-slate-800">
                      {m.n}{" "}
                      <span className="font-bold text-slate-400">
                        {totalNuvem ? Math.round((m.n / totalNuvem) * 100) : 0}%
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {motivoPick && (
            <MiniList
              title={motivoPick}
              empty="Nenhum cliente com esse motivo no período."
              rows={motivoRows.map((e) => ({
                title: e.cliente_nome || "Cliente",
                meta: [e.cidade, e.rota_nome, e.vendedor_nome, e.motivo].filter(Boolean).join(" · "),
              }))}
            />
          )}
        </Card>

        <Card title="Pódio" subtitle="Clique na atendente para ver os clientes" icon={<Trophy className="h-4 w-4 text-amber-500" />}>
          {ranked.length === 0 && <Empty />}
          <div className="flex items-end justify-center gap-3 pt-4">
            {podium.map((c, i) => {
              const center = i === 1 || podium.length === 1;
              const convP = c.conversao ?? Math.round((c.finalizado / Math.max(c.finalizado + c.nao_venda, 1)) * 100);
              const on = colabPick === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColabPick((cur) => (cur === c.id ? null : c.id))}
                  className={cn(
                    "flex flex-col items-center rounded-2xl px-1 pb-1",
                    center ? "order-2" : i === 0 ? "order-1" : "order-3",
                    on && "ring-2 ring-orange-400",
                  )}
                >
                  <span
                    className={cn(
                      "grid place-items-center rounded-full font-black text-white",
                      center ? "h-14 w-14 bg-orange-500 text-lg" : "h-10 w-10 bg-orange-200 text-orange-800 text-sm",
                    )}
                  >
                    {c.nome[0]}
                  </span>
                  <p className={cn("mt-2 font-extrabold", center ? "text-slate-900" : "text-slate-500")}>{c.nome}</p>
                  <p className="text-[11px] font-bold text-slate-400">{convP}% conv.</p>
                  <div
                    className={cn("mt-2 w-16 rounded-t-2xl", center ? "bg-gradient-to-b from-orange-400 to-avinor" : "bg-orange-50")}
                    style={{ height: center ? 88 : 56 }}
                  />
                  <p className={cn("mt-1 font-display font-black", center ? "text-3xl text-slate-900" : "text-xl text-slate-500")}>
                    {c.finalizado}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs font-extrabold text-orange-500">
            Time somou {ranked.reduce((s, c) => s + c.finalizado, 0)} vendas
          </p>
        </Card>
      </div>

      {colabPick && (
        <Card title={`Clientes de ${colabNome || "atendente"}`} subtitle={`${colabRows.length} vendas no período`}>
          <MiniList
            empty="Essa atendente ainda não fechou venda neste recorte."
            rows={colabRows.map((e) => ({
              title: e.cliente_nome || "Cliente",
              value: formatMoney(e.valor_total),
              meta: [e.cidade, e.rota_nome].filter(Boolean).join(" · ") || "sem rota",
            }))}
          />
        </Card>
      )}
    </div>
  );
}

function Donut({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#ecfdf5" strokeWidth="10" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="#10b981"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="font-display text-lg font-black leading-none text-emerald-600">{pct}%</p>
        <p className="text-[9px] font-extrabold uppercase tracking-wide text-emerald-700/70">Conversão</p>
      </div>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const w = 360;
  const h = 64;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 8) - 4}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-16 w-full text-orange-400" preserveAspectRatio="none">
      <polyline fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" points={pts} />
    </svg>
  );
}

function Legend({ n, pct, label, color }: { n: number; pct: number; label: string; color: string }) {
  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
        <span className={cn("h-2 w-2 rounded-full", color)} />
        {label}
      </p>
      <p className="font-display text-2xl font-black text-slate-900">{n}</p>
      <p className="text-xs font-bold text-slate-400">{pct}%</p>
    </div>
  );
}

function DotRow({ label, n, color }: { label: string; n: number; color: string }) {
  const total = 18;
  const filled = Math.min(total, n);
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-orange-100/80">
        <span>{label}</span>
        <span className="font-black text-white">{n || "—"}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={cn("h-2.5 w-2.5 rounded-full", i < filled ? color : "bg-white/15")} />
        ))}
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  extra,
  icon,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  extra?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="inline-flex items-center gap-2 font-display text-lg font-extrabold">
            {icon}
            {title}
          </h3>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function MiniList({
  title,
  rows,
  empty,
}: {
  title?: string;
  empty: string;
  rows: { title: string; meta: string; value?: string }[];
}) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      {title && <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{title}</p>}
      {rows.length === 0 ? (
        <Empty text={empty} />
      ) : (
        <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <li key={`${r.title}-${i}`} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-extrabold text-slate-800">{r.title}</p>
                {r.value ? <p className="shrink-0 text-sm font-black text-slate-900">{r.value}</p> : null}
              </div>
              <p className="truncate text-[11px] font-bold text-slate-400">{r.meta}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Empty({ text = "Ainda sem movimento neste recorte." }: { text?: string }) {
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-6 text-sm text-slate-400">
      <ShoppingBag className="h-4 w-4" />
      {text}
    </p>
  );
}
