import { Crown, Headphones, Plus, Shield, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type Account = {
  id: number;
  role: "adm" | "colaborador";
  nome: string;
  login: string;
  vendedor_id: number | null;
  aliases: string[];
  active: boolean;
};

const EMPTY = { nome: "", login: "", password: "", vendedor_id: "", aliases: "" };

export function ColaboradoresPage() {
  const [items, setItems] = useState<Account[]>([]);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);

  const load = () => api<Account[]>("/api/accounts").then(setItems).catch((e: Error) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  const admins = items.filter((a) => a.role === "adm");
  const team = items.filter((a) => a.role === "colaborador");

  const openEdit = (a: Account) => {
    setEditing(a.id);
    setForm({
      nome: a.nome,
      login: a.login,
      password: "",
      vendedor_id: a.vendedor_id ? String(a.vendedor_id) : "",
      aliases: (a.aliases || []).join(", "),
    });
  };

  const openNew = () => {
    setEditing("new");
    setForm(EMPTY);
  };

  const save = async (role: "adm" | "colaborador", id?: number) => {
    try {
      const payload: Record<string, unknown> = {
        nome: form.nome,
        login: form.login,
        aliases: form.aliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (form.password.trim()) payload.password = form.password.trim();
      if (role === "colaborador") payload.vendedor_id = Number(form.vendedor_id);
      if (id) {
        await api(`/api/accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Acesso atualizado.");
      } else {
        payload.role = role;
        payload.password = form.password.trim();
        await api("/api/accounts", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Colaborador criado.");
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (a: Account) => {
    if (!confirm(`Remover o acesso de ${a.nome}?`)) return;
    try {
      await api(`/api/accounts/${a.id}`, { method: "DELETE" });
      toast.success("Conta removida.");
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
        Contas que entram no painel. A senha da colaboradora, por enquanto, pode continuar sendo o código da carteira —
        ou você troca para um acesso próprio. O administrador tem um cartão à parte.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        {admins.map((a) => (
          <article
            key={a.id}
            className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1b2437] via-[#161d2e] to-[#3a1c12] p-6 text-white shadow-lift ring-1 ring-white/10"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-avinor/30 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-10 h-24 w-24 rounded-full bg-amber-300/20 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-200 ring-1 ring-white/15">
                <Crown className="h-3.5 w-3.5 text-amber-300" />
                Administrador
              </span>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-avinor text-white shadow-lg shadow-avinor/40">
                <Shield className="h-5 w-5" />
              </span>
            </div>
            <h2 className="relative mt-5 font-display text-3xl font-black tracking-tight">{a.nome}</h2>
            <p className="relative mt-1 text-sm font-bold text-white/55">Acesso total ao painel · login {a.login}</p>
            {editing === a.id ? (
              <Form
                form={form}
                setForm={setForm}
                collab={false}
                passwordHint="Deixe em branco para manter a senha atual"
                onCancel={() => setEditing(null)}
                onSave={() => save("adm", a.id)}
              />
            ) : (
              <button
                type="button"
                onClick={() => openEdit(a)}
                className="relative mt-6 rounded-xl bg-white/10 px-4 py-2 text-sm font-extrabold text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                Alterar meu acesso
              </button>
            )}
          </article>
        ))}

        <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/60 p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Como entra</p>
          <ul className="mt-3 space-y-2 text-sm font-medium text-slate-500">
            <li>Colaboradora: nome ou login + senha (hoje o código 1071 / 1072 / 1073).</li>
            <li>Administrador: adm + a senha do cartão ao lado.</li>
            <li>Tudo isso grava no Neon. Apagou uma conta, ela some do login.</li>
          </ul>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-extrabold text-slate-900">Equipe de televendas</h3>
            <p className="text-sm text-slate-400">{team.length} colaboradora(s) ativas</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {team.map((a) => (
            <article
              key={a.id}
              className={cn(
                "rounded-[28px] border bg-white p-5 shadow-card transition",
                editing === a.id ? "border-avinor/30 ring-2 ring-avinor/15" : "border-slate-100 hover:-translate-y-0.5 hover:shadow-lift",
              )}
            >
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 font-display text-lg font-black text-avinor">
                  {a.nome.slice(0, 1)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  <Headphones className="h-3 w-3" />
                  Colaboradora
                </span>
              </div>
              <h3 className="mt-4 font-display text-2xl font-black tracking-tight text-slate-900">{a.nome}</h3>
              <p className="mt-1 text-sm font-bold text-slate-400">login · {a.login}</p>
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 font-mono text-sm font-extrabold text-slate-600">
                carteira {a.vendedor_id || "—"}
              </p>
              {editing === a.id ? (
                <Form
                  form={form}
                  setForm={setForm}
                  collab
                  passwordHint="Vazio = mantém a senha"
                  onCancel={() => setEditing(null)}
                  onSave={() => save("colaborador", a.id)}
                  onDelete={() => remove(a)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-50"
                >
                  Editar acesso
                </button>
              )}
            </article>
          ))}

          {editing === "new" ? (
            <article className="rounded-[28px] border border-avinor/30 bg-white p-5 shadow-card ring-2 ring-avinor/15">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-avinor">Nova colaboradora</p>
              <Form
                form={form}
                setForm={setForm}
                collab
                passwordHint="Senha inicial (pode ser o código da carteira)"
                onCancel={() => setEditing(null)}
                onSave={() => save("colaborador")}
              />
            </article>
          ) : (
            <button
              type="button"
              onClick={openNew}
              className="grid min-h-[220px] place-items-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/50 text-slate-400 transition hover:border-avinor/40 hover:bg-orange-50/40 hover:text-avinor"
            >
              <span className="flex flex-col items-center gap-2 text-sm font-extrabold">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm">
                  <Plus className="h-5 w-5" />
                </span>
                Nova colaboradora
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Form({
  form,
  setForm,
  collab,
  passwordHint,
  onCancel,
  onSave,
  onDelete,
}: {
  form: typeof EMPTY;
  setForm: (v: typeof EMPTY) => void;
  collab: boolean;
  passwordHint: string;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={cn("space-y-2.5", collab ? "mt-4" : "relative mt-5")}>
      <Field label="Nome" value={form.nome} onChange={(nome) => setForm({ ...form, nome })} light={!collab} />
      <Field label="Login" value={form.login} onChange={(login) => setForm({ ...form, login })} light={!collab} />
      {collab && (
        <Field
          label="Código da carteira"
          value={form.vendedor_id}
          onChange={(vendedor_id) => setForm({ ...form, vendedor_id })}
        />
      )}
      <Field
        label="Senha"
        value={form.password}
        onChange={(password) => setForm({ ...form, password })}
        light={!collab}
        placeholder={passwordHint}
        secret
      />
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-extrabold",
            collab ? "bg-avinor text-white" : "bg-white text-slate-900",
          )}
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={cn("rounded-xl px-3 py-2 text-sm font-extrabold", collab ? "text-slate-400" : "text-white/70")}
        >
          Cancelar
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="ml-auto inline-flex items-center gap-1 text-sm font-extrabold text-rose-400 hover:text-rose-600">
            <Trash2 className="h-3.5 w-3.5" />
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  light,
  placeholder,
  secret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  light?: boolean;
  placeholder?: string;
  secret?: boolean;
}) {
  return (
    <label className="block">
      <span className={cn("text-[10px] font-extrabold uppercase tracking-wide", light ? "text-white/50" : "text-slate-400")}>
        {label}
      </span>
      <input
        type={secret ? "password" : "text"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none",
          light
            ? "bg-white/10 text-white ring-1 ring-white/15 placeholder:text-white/30"
            : "border border-slate-200 bg-white text-slate-800",
        )}
      />
    </label>
  );
}
