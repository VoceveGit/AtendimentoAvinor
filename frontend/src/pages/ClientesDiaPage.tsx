import { CalendarDays, CheckCircle2, ChevronDown, MapPin, Phone, Search } from "lucide-react";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CollaboratorFilter } from "../components/CollaboratorFilter";
import { FinalizeModal } from "../components/FinalizeModal";
import { MotivoModal } from "../components/MotivoModal";
import { NovoAtendimento } from "../components/NovoAtendimento";
import { StatusBadge, StatusPicker } from "../components/StatusBadge";
import { Streak } from "../components/Streak";
import { TablePager } from "../components/TablePager";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { COLOR_DOT } from "../lib/status";
import type { Client, Colaboradora, Status } from "../lib/types";
import { cn, formatDate, formatDoc, formatMoney, formatPhone, telHref } from "../lib/utils";

const PAGE_SIZE = 10;

type Payload = {
  date: string;
  total: number;
  page: number;
  page_size: number;
  routes: { id: string; nome: string }[];
  items: Client[];
  colaboradoras?: Colaboradora[];
  agendados?: number;
};

export function ClientesDiaPage() {
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [rota, setRota] = useState(() => searchParams.get("rota") || "todas");
  const [status, setStatus] = useState(() => {
    const s = searchParams.get("status") || "todos";
    return s === "sem_status" ? "todos" : s;
  });
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [vendedor, setVendedor] = useState(() => searchParams.get("vendedor") || "todas");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Payload | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [finalizeFor, setFinalizeFor] = useState<Client | null>(null);
  const [motivoFor, setMotivoFor] = useState<{ client: Client; status: Status } | null>(null);

  const load = () => {
    const params = new URLSearchParams({
      q,
      rota,
      status,
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    if (vendedor !== "todas") params.set("vendedor", vendedor);
    const ref = searchParams.get("ref");
    if (ref) params.set("ref", ref);
    api<Payload>(`/api/clients/today?${params}`)
      .then(setData)
      .catch((e: Error) => toast.error(e.message));
  };

  useEffect(() => {
    api<Status[]>("/api/statuses").then(setStatuses).catch(() => undefined);
  }, []);

  const refDay = searchParams.get("ref") || "";

  useEffect(() => {
    load();
  }, [q, rota, status, page, vendedor, refDay]);

  const changeStatus = async (id: number, status_id: string, extra?: { data_atendimento?: string }) => {
    try {
      await api(`/api/clients/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status_id, updated_by: role, ...extra }),
      });
      if (extra?.data_atendimento) {
        toast.success(`Agendado para ${formatDate(extra.data_atendimento)}. Fica na aba Agendados e entra no dia marcado.`);
      } else {
        toast.success("Status atualizado.");
      }
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const confirmMotivo = async (motivo: string) => {
    if (!motivoFor) return;
    try {
      if (["nao_venda", "nao_recuperado"].includes(motivoFor.status.id)) {
        await api(`/api/clients/${motivoFor.client.id}/close`, {
          method: "POST",
          body: JSON.stringify({ kind: motivoFor.status.id, motivo, origem: "carteira" }),
        });
      } else {
        await api(`/api/clients/${motivoFor.client.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status_id: motivoFor.status.id, observacoes: motivo, updated_by: role }),
        });
      }
      toast.success("Registrado.");
      setMotivoFor(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const statusPills = statuses.filter((s) => !["em_recuperacao", "finalizado", "nao_recuperado", "sem_status"].includes(s.id));
  const toggleOpen = (id: number) => {
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CollaboratorFilter
          value={vendedor}
          onChange={(id) => {
            setVendedor(id);
            setPage(1);
          }}
          team={data?.colaboradoras}
        />
        <NovoAtendimento vendedor={vendedor} onAdded={load} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Buscar por nome, cidade, end."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-avinor/40"
          />
        </div>
        <Pill
          active={rota === "todas"}
          onClick={() => {
            setRota("todas");
            setPage(1);
          }}
        >
          Todas as rotas
        </Pill>
        {(data?.routes || []).map((r) => (
          <Pill
            key={r.id}
            active={rota === r.id}
            onClick={() => {
              setRota(r.id);
              setPage(1);
            }}
          >
            {r.nome}
          </Pill>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
        <Pill
          active={status === "todos"}
          onClick={() => {
            setStatus("todos");
            setPage(1);
          }}
        >
          Todos
        </Pill>
        <Pill
          active={status === "agendados"}
          onClick={() => {
            setStatus("agendados");
            setPage(1);
          }}
        >
          <CalendarDays className="mr-1 h-3 w-3" />
          Agendados ({data?.agendados || 0})
        </Pill>
        {statusPills.map((s) => (
          <Pill
            key={s.id}
            active={status === s.id}
            onClick={() => {
              setStatus(s.id);
              setPage(1);
            }}
          >
            <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full", COLOR_DOT[s.color] || COLOR_DOT.slate)} />
            {s.label}
          </Pill>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Endereço</th>
                <th className="px-3 py-3">Contato</th>
                <th className="px-3 py-3">Cidade</th>
                <th className="px-3 py-3">Rota</th>
                <th className="px-3 py-3">Vendedora</th>
                <th className="px-3 py-3">Último</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((c) => {
                const expanded = open.has(c.id);
                return (
                  <Fragment key={c.id}>
                    <tr
                      className={cn(
                        "cursor-pointer border-t border-slate-100 transition hover:bg-orange-50/60",
                        expanded && "bg-orange-50/80",
                      )}
                      onClick={() => toggleOpen(c.id)}
                    >
                      <td className="px-3 py-3">
                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition", expanded && "rotate-180 text-orange-500")} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{c.nome}</p>
                            <p className="font-mono text-[11px] text-slate-400">#{String(c.id).padStart(5, "0")}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {c.extra_hoje && (
                                <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-700">
                                  Fora da rota
                                </span>
                              )}
                              {c.data_atendimento && c.status_id !== "atendido" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-extrabold text-violet-700">
                                  <CalendarDays className="h-3 w-3" />
                                  {c.agendado_hoje ? "Agendado hoje" : `Agendado · ${formatDate(c.data_atendimento)}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <Streak value={c.streak} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <span className="inline-flex items-start gap-1">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 text-slate-400" />
                          <span className="line-clamp-2 max-w-[220px]">{c.endereco || "—"}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 font-extrabold text-slate-800">
                          <Phone className="h-4 w-4 text-orange-500" />
                          {formatPhone(c.telefone)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-extrabold text-slate-600">{c.cidade || "—"}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          {c.rota_nome || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-extrabold text-slate-600">{c.vendedor_nome || "—"}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(c.ultima_compra)}</td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <StatusBadge
                          status={c.status}
                          statuses={statuses}
                          origem="carteira"
                          onChange={(sid, extra) => changeStatus(c.id, sid, extra)}
                          onNeedMotivo={(s) => setMotivoFor({ client: c, status: s })}
                        />
                      </td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setFinalizeFor(c)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Finalizar
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-t border-orange-100 bg-orange-50/40">
                        <td colSpan={10} className="px-5 pb-4 pt-1">
                          <ClientExpand
                            client={c}
                            statuses={statuses}
                            onStatus={(sid, extra) => changeStatus(c.id, sid, extra)}
                            onNeedMotivo={(s) => setMotivoFor({ client: c, status: s })}
                            onFinalize={() => setFinalizeFor(c)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-sm text-slate-500">
                    {status === "agendados" ? "Nenhum cliente agendado." : "Nenhum cliente neste filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePager page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onPage={setPage} />
      </div>
      {finalizeFor && (
        <FinalizeModal
          clienteId={finalizeFor.id}
          clienteNome={finalizeFor.nome}
          origem="carteira"
          onCancel={() => setFinalizeFor(null)}
          onDone={() => {
            setFinalizeFor(null);
            load();
          }}
        />
      )}
      {motivoFor && (
        <MotivoModal
          title={motivoFor.status.label}
          hint="Esse status exige um motivo escrito."
          onCancel={() => setMotivoFor(null)}
          onConfirm={confirmMotivo}
        />
      )}
    </div>
  );
}

function ClientExpand({
  client,
  statuses,
  onStatus,
  onNeedMotivo,
  onFinalize,
}: {
  client: Client;
  statuses: Status[];
  onStatus: (statusId: string, extra?: { data_atendimento?: string }) => void;
  onNeedMotivo: (status: Status) => void;
  onFinalize: () => void;
}) {
  const phone = formatPhone(client.telefone);
  const href = telHref(client.telefone);
  const top = client.produtos_top || [];
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm" onClick={(e) => e.stopPropagation()}>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
        <div>
          <p className="font-display text-2xl font-black text-slate-900">{client.nome}</p>
          {client.razao_social && client.razao_social !== client.nome && (
            <p className="text-sm font-bold text-slate-400">{client.razao_social}</p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Info label="CNPJ / CPF" value={formatDoc(client.cpf)} />
            <Info label="Faturamento médio / mês" value={formatMoney(client.fat_medio_mes)} accent />
            <Info label="Ticket médio" value={formatMoney(client.ticket_medio)} />
          </div>
          {href ? (
            <a
              href={href}
              className="mt-4 inline-flex items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-orange-800 ring-1 ring-orange-100 hover:bg-orange-100"
            >
              <Phone className="h-7 w-7" />
              <span className="font-display text-3xl font-black tracking-tight">{phone}</span>
            </a>
          ) : (
            <p className="mt-4 font-display text-3xl font-black text-slate-300">Sem telefone</p>
          )}
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Status do atendimento</p>
          <div className="mt-2">
            <StatusPicker
              status={client.status}
              statuses={statuses}
              origem="carteira"
              onChange={onStatus}
              onNeedMotivo={onNeedMotivo}
            />
          </div>
          <button
            type="button"
            onClick={onFinalize}
            className="mt-4 inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Finalizar venda
          </button>
        </div>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Produtos que mais compra</p>
          {top.length === 0 ? (
            <p className="mt-2 rounded-xl bg-slate-50 px-3 py-6 text-sm text-slate-400">Ainda sem histórico de produto neste cliente.</p>
          ) : (
            <ul className="mt-2 overflow-hidden rounded-2xl border border-slate-100">
              {top.map((p, i) => (
                <li key={`${p.nome}-${i}`} className={cn("px-3 py-3", i === 0 ? "bg-orange-50" : i % 2 ? "bg-slate-50" : "bg-white")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {i === 0 && (
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-orange-500">Mais compra</p>
                      )}
                      <p className="truncate font-extrabold text-slate-900">{p.nome}</p>
                      {p.sku ? <p className="font-mono text-[11px] text-slate-400">{p.sku}</p> : null}
                    </div>
                    <p className={cn("shrink-0 font-black", i === 0 ? "text-lg text-orange-700" : "text-slate-800")}>
                      {formatMoney(p.valor)}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">faturamento deste produto até agora</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-0.5 font-extrabold", accent ? "text-lg text-orange-700" : "text-slate-800")}>{value}</p>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold",
        active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}
