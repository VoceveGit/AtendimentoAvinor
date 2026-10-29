import {
  CircleCheck,
  Database,
  FileSpreadsheet,
  Headphones,
  IdCard,
  LayoutDashboard,
  LogOut,
  MapPinned,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Settings2,
  Shield,
  Siren,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, apiUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDemo } from "../lib/demo";
import { cn } from "../lib/utils";

const MAIN = [
  { to: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/clientes-do-dia", label: "Clientes do Dia", icon: Users },
  { to: "/clientes-recuperacao", label: "Em Recuperação", icon: Siren },
  { to: "/finalizados", label: "Finalizados", icon: CircleCheck },
  { to: "/rotas", label: "Rotas da Semana", icon: MapPinned },
];

const ADMIN = [
  { to: "/colaboradores", label: "Colaboradores", icon: IdCard },
  { to: "/relatorios", label: "Analytics ADM", icon: PieChart },
  { to: "/config-status", label: "Configurar Status", icon: Settings2 },
  { to: "/config-banco", label: "Conexão de Banco", icon: Database },
  { to: "/importar-planilha", label: "Importar Planilha", icon: FileSpreadsheet },
];

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Visão Geral", subtitle: "Resumo operacional do atendimento de hoje" },
  "/clientes-do-dia": { title: "Clientes do Dia", subtitle: "Atendimentos da rota de hoje — alinhados a Enviar cards" },
  "/clientes-recuperacao": {
    title: "Em Recuperação",
    subtitle: "Fila do dia · teto 30 · melhores clientes de cada faixa",
  },
  "/finalizados": {
    title: "Finalizados",
    subtitle: "Pedidos concluídos — unificando carteira e recuperação",
  },
  "/colaboradores": {
    title: "Colaboradores",
    subtitle: "Contas, logins e senhas da equipe — o ADM também muda o próprio acesso",
  },
  "/relatorios": {
    title: "A história do mês",
    subtitle: "Tudo que entrou, virou venda ou escapou",
  },
  "/rotas": { title: "Rotas da Semana", subtitle: "Distribuição semanal de atendimento por rota (Enviar cards)" },
  "/config-status": {
    title: "Configurador de Status",
    subtitle: "Cadastre e arraste a ordem. Status automáticos vêm das ações (agendar, finalizar)",
  },
  "/config-banco": {
    title: "Conexão de Banco de Dados",
    subtitle: "Configure os dois bancos: leitura (MySQL) e escrita (Neon PostgreSQL)",
  },
  "/importar-planilha": {
    title: "Importar Planilha de Rotas",
    subtitle: "Faça upload do .xlsx e mapeie as colunas automaticamente",
  },
};

export function AppShell() {
  const { role, user, logout } = useAuth();
  const { mock, toggle } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const meta = TITLES[location.pathname] || { title: "Avinor", subtitle: "" };
  const isAdm = role === "adm";
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("avinor_sidebar") === "1";
    } catch {
      return false;
    }
  });
  const [writeBackend, setWriteBackend] = useState<string | null>(null);

  const toggleSidebar = () => {
    setCollapsed((cur) => {
      const next = !cur;
      try {
        localStorage.setItem("avinor_sidebar", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  useEffect(() => {
    if (!isAdm) return;
    api<{ write?: string; write_persistent?: boolean }>("/api/health")
      .then((h) => setWriteBackend(h.write || null))
      .catch(() => undefined);
  }, [isAdm]);
  const subtitle =
    !isAdm && location.pathname === "/dashboard"
      ? `Sua carteira · ${user?.nome}`
      : !isAdm && meta.subtitle
        ? `${meta.subtitle} · ${user?.nome}`
        : meta.subtitle;

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className={cn("flex shrink-0 flex-col bg-night text-slate-300 transition-[width]", collapsed ? "w-[76px]" : "w-[248px]")}>
        <div className={cn("flex items-center py-5", collapsed ? "justify-center px-2" : "gap-3 px-5")}>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-avinor font-display text-lg font-extrabold text-white">
            A
          </div>
          {!collapsed && (
            <div>
              <p className="font-display text-base font-bold leading-none text-white">Avinor</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Gestão de atendimento
              </p>
            </div>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {MAIN.map((item) => (
            <Item key={item.to} {...item} collapsed={collapsed} />
          ))}
          {isAdm && (
            <>
              {!collapsed && (
                <p className="mb-1 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Administração
                </p>
              )}
              {collapsed && <div className="my-3 h-px bg-white/10" />}
              {ADMIN.map((item) => (
                <Item key={item.to} {...item} collapsed={collapsed} />
              ))}
            </>
          )}
        </nav>
        <button
          type="button"
          onClick={toggleSidebar}
          className="m-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
          title={collapsed ? "Expandir menu" : "Encolher menu"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && "Encolher"}
        </button>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="m-3 mt-0 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Sair"}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-8 pb-2 pt-7">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] font-extrabold tracking-tight text-slate-900">{meta.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ring-1",
                mock
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50",
              )}
              title="Alterna entre dados reais do painel e uma demonstração preenchida"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {mock ? "Modo demonstração" : "Modo real"}
            </button>
            {location.pathname === "/clientes-do-dia" && (
              <a
                href={apiUrl("/api/clients/today?page_size=5000")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Exportar
              </a>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1",
                isAdm
                  ? "bg-avinor/10 text-avinor ring-avinor/20"
                  : "bg-sky-50 text-sky-700 ring-sky-200",
              )}
            >
              {isAdm ? <Shield className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />}
              {isAdm ? "Administrador" : user?.nome || "Colaborador"}
            </span>
          </div>
        </header>
        <main className="flex-1 px-8 pb-10 pt-4">
          {isAdm && writeBackend === "sqlite" && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              A escrita está no SQLite local — no Render isso some no deploy (status apagado volta, finalizado some).
              Em Conexão de Banco cole a URL do Neon e também cadastre <span className="font-extrabold">NEON_DATABASE_URL</span> no Environment do serviço.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Item({ to, label, icon: Icon, collapsed }: { to: string; label: string; icon: typeof Users; collapsed?: boolean }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition",
          collapsed ? "justify-center" : "gap-2.5",
          isActive ? "bg-avinor text-white shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
    </NavLink>
  );
}
