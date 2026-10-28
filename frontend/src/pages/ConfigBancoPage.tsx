import { Database, Eye, EyeOff, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";

type Cfg = {
  mysql: { host: string; port: number; database: string; user: string; password: string; ssl: boolean; connected: boolean; readonly: boolean };
  neon: { connection_string: string; pool_min: number; pool_max: number; ssl: boolean; connected: boolean; write?: string };
  write?: string;
};

export function ConfigBancoPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showNeon, setShowNeon] = useState(false);

  useEffect(() => {
    api<Cfg>("/api/db/config").then(setCfg).catch((e: Error) => toast.error(e.message));
  }, []);

  if (!cfg) return <p className="text-sm text-slate-500">Carregando conexões...</p>;

  const testMysql = async () => {
    try {
      await api("/api/db/test-mysql", { method: "POST", body: JSON.stringify(cfg.mysql) });
      toast.success("MySQL conectado (somente leitura).");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const testNeon = async () => {
    try {
      const r = await api<{ detail?: string; mode?: string }>("/api/db/test-neon", { method: "POST", body: JSON.stringify(cfg.neon) });
      toast.success(r.detail || "Neon ok.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const save = async () => {
    try {
      const r = await api<{ write?: string }>("/api/db/save-config", { method: "POST", body: JSON.stringify(cfg) });
      toast.success(
        r.write === "neon"
          ? "Neon conectado. Status, atendimentos e finalizados passam a gravar lá."
          : "Salvo, mas a escrita ainda é SQLite — no Render isso some no deploy. Coloque NEON_DATABASE_URL no Environment.",
      );
      const next = await api<Cfg>("/api/db/config");
      setCfg(next);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700">
                <Database className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display font-semibold">MySQL · Leitura</h3>
                <p className="text-xs text-slate-500">Fonte dos dados dos clientes · EXTRACTOR</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Consulta apenas</span>
          </div>
          <Field label="Host" value={cfg.mysql.host} onChange={(v) => setCfg({ ...cfg, mysql: { ...cfg.mysql, host: v } })} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Porta" value={String(cfg.mysql.port)} onChange={(v) => setCfg({ ...cfg, mysql: { ...cfg.mysql, port: Number(v) || 3306 } })} />
            <Field label="Banco" value={cfg.mysql.database} onChange={(v) => setCfg({ ...cfg, mysql: { ...cfg.mysql, database: v } })} />
          </div>
          <div className="mt-3">
            <Field label="Usuário" value={cfg.mysql.user} onChange={(v) => setCfg({ ...cfg, mysql: { ...cfg.mysql, user: v } })} />
          </div>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-400">Senha</label>
          <div className="relative mt-1">
            <input
              type={showPass ? "text" : "password"}
              value={cfg.mysql.password}
              onChange={(e) => setCfg({ ...cfg, mysql: { ...cfg.mysql, password: e.target.value } })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm"
            />
            <button type="button" className="absolute right-2 top-2.5 text-slate-400" onClick={() => setShowPass((v) => !v)}>
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={cfg.mysql.ssl} onChange={(e) => setCfg({ ...cfg, mysql: { ...cfg.mysql, ssl: e.target.checked } })} />
            SSL obrigatório
          </label>
          <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Esta conexão é bloqueada no backend para SELECT. Nada é criado, editado ou excluído no EXTRACTOR.
          </p>
          <button type="button" onClick={testMysql} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
            <PlugZap className="h-4 w-4" /> Testar conexão
          </button>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <Database className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display font-semibold">Neon · PostgreSQL (Escrita)</h3>
                <p className="text-xs text-slate-500">Armazena status, histórico e configurações</p>
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                cfg.write === "neon" || cfg.neon.connected
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {cfg.write === "neon" || cfg.neon.connected ? "Gravando no Neon" : "SQLite (some no deploy)"}
            </span>
          </div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Connection string</label>
          <div className="relative mt-1">
            <input
              type={showNeon ? "text" : "password"}
              value={cfg.neon.connection_string}
              onChange={(e) => setCfg({ ...cfg, neon: { ...cfg.neon, connection_string: e.target.value } })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm"
              placeholder="postgresql://..."
            />
            <button type="button" className="absolute right-2 top-2.5 text-slate-400" onClick={() => setShowNeon((v) => !v)}>
              {showNeon ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Pool mínimo" value={String(cfg.neon.pool_min)} onChange={(v) => setCfg({ ...cfg, neon: { ...cfg.neon, pool_min: Number(v) || 2 } })} />
            <Field label="Pool máximo" value={String(cfg.neon.pool_max)} onChange={(v) => setCfg({ ...cfg, neon: { ...cfg.neon, pool_max: Number(v) || 10 } })} />
          </div>
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Status, atendimentos, finalizados e analytics gravam aqui. No Render a URL também precisa estar em
            Environment → <span className="font-extrabold">NEON_DATABASE_URL</span> — o disco do Docker apaga o SQLite a cada deploy.
          </p>
          {cfg.write !== "neon" && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Agora mesmo o painel não está no Neon. Por isso status apagado volta depois do deploy.
            </p>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={cfg.neon.ssl} onChange={(e) => setCfg({ ...cfg, neon: { ...cfg.neon, ssl: e.target.checked } })} />
            SSL obrigatório
          </label>
          <button type="button" onClick={testNeon} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            <PlugZap className="h-4 w-4" /> Testar conexão
          </button>
        </section>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          Cancelar
        </button>
        <button type="button" onClick={save} className="rounded-lg bg-avinor px-4 py-2 text-sm font-semibold text-white">
          Salvar configurações
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
    </label>
  );
}
