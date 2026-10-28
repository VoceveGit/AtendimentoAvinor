import { ArrowRight, KeyRound, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { login, role } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (role) return <Navigate to="/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (error) {
      setErr((error as Error).message || "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F7F8FB]">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(#e8edf5 1px, transparent 1px), linear-gradient(90deg, #e8edf5 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-8 py-12 lg:grid-cols-2">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-avinor font-display text-xl font-extrabold text-white shadow-lg shadow-avinor/30">
              A
            </div>
            <div>
              <p className="font-display text-lg font-bold text-slate-900">Avinor</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Painel de atendimento
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-avinor/10 px-3 py-1 text-xs font-semibold text-avinor">
            Televendas · Poliana, Fernanda e Karolline
          </span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-900">
            Cada carteira no
            <br />
            ritmo da <span className="text-avinor">sua vendedora.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-500">
            Entre com o seu nome. A senha é o código da carteira. O administrador vê as três juntas
            e filtra o andamento de cada uma.
          </p>
          <p className="mt-16 text-xs text-slate-400">© 2026 Avinor · Vitória da Conquista, BA</p>
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-white/80 bg-white p-8 shadow-card">
          <h2 className="font-display text-2xl font-extrabold text-slate-900">Entrar</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Nome da colaboradora ou adm, e a senha.</p>
          <label className="mt-6 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
            Usuário
          </label>
          <div className="relative mt-1.5">
            <UserRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="poliana, fernanda, karolline ou adm"
              autoComplete="username"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-semibold outline-none focus:border-avinor/40"
            />
          </div>
          <label className="mt-4 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
            Senha
          </label>
          <div className="relative mt-1.5">
            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="código da carteira"
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-semibold outline-none focus:border-avinor/40"
            />
          </div>
          {err && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{err}</p>}
          <button
            type="submit"
            disabled={busy || !username || !password}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-avinor py-3 text-sm font-extrabold text-white shadow-lg shadow-avinor/20 transition hover:bg-avinor-600 disabled:opacity-50"
          >
            {busy ? "Entrando..." : "Entrar no painel"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
