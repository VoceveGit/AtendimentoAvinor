import { CheckCircle2, Loader2, MapPin, PackageSearch, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { formatMoney } from "../lib/utils";

type Lookup = {
  found: boolean;
  codigo?: string;
  valor_total?: number;
  itens?: { descricao?: string; qtd?: number; valor?: number }[];
  data_pedido?: string;
  data_emissao?: string;
  cliente_nome?: string;
  status?: string;
};

type Props = {
  clienteNome: string;
  origem: "carteira" | "recuperacao";
  onCancel: () => void;
  onDone: (extra?: { codigo?: string; valor?: number; kind?: string }) => void;
  clienteId: number;
  simulate?: boolean;
  rotaNome?: string | null;
  enviarCards?: string | null;
  cidade?: string | null;
};

export function FinalizeModal({
  clienteNome,
  origem,
  onCancel,
  onDone,
  clienteId,
  simulate,
  rotaNome,
  enviarCards,
  cidade,
}: Props) {
  const isRecovery = origem === "recuperacao";
  const [step, setStep] = useState<"aviso" | "venda">(isRecovery ? "aviso" : "venda");
  const [codigo, setCodigo] = useState("");
  const [valor, setValor] = useState("");
  const [hit, setHit] = useState<Lookup | null>(null);
  const [loading, setLoading] = useState(false);

  const buscar = async () => {
    if (!codigo.trim()) return;
    setLoading(true);
    try {
      const data = await api<Lookup>(`/api/pedidos/lookup?codigo=${encodeURIComponent(codigo.trim())}`);
      setHit(data);
      if (data.found && data.valor_total != null) setValor(String(data.valor_total));
      if (!data.found) toast.message("Pedido ainda não está no banco. Informe o valor total.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const confirmarCadastro = async () => {
    if (simulate) {
      toast.success("Recuperado na demonstração — cadastro vai para a carteira no dia da rota.");
      onDone({ kind: "recuperado" });
      return;
    }
    setLoading(true);
    try {
      await api(`/api/clients/${clienteId}/close`, {
        method: "POST",
        body: JSON.stringify({ kind: "recuperado", origem: "recuperacao" }),
      });
      toast.success("Recuperado. No dia da rota dele, entra em Clientes do Dia.");
      onDone({ kind: "recuperado" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const salvarVenda = async () => {
    const total = valor ? Number(valor.replace(",", ".")) : undefined;
    if (simulate) {
      toast.success("Recuperado com venda — só na demonstração.");
      onDone({ codigo: codigo.trim(), valor: total, kind: "finalizado" });
      return;
    }
    setLoading(true);
    try {
      await api(`/api/clients/${clienteId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          codigo_pedido: codigo.trim(),
          valor_total: total,
          origem,
        }),
      });
      toast.success(isRecovery ? "Recuperado com venda." : "Atendimento finalizado.");
      onDone({ codigo: codigo.trim(), valor: total, kind: "finalizado" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (isRecovery && step === "aviso") {
    return (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/40 p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-lift">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500 text-white">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-extrabold text-slate-900">Cliente recuperado</h3>
              <p className="text-sm text-slate-500">{clienteNome}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-900">
            Atualize o cadastro no ERP para o código da vendedora. Não precisa vender agora. Quando for o dia da rota
            dele, esse cliente entra sozinho em <span className="font-extrabold">Clientes do Dia</span>.
          </div>
          <p className="mt-3 flex items-start gap-2 text-sm text-slate-500">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <span>
              {cidade || "Cidade"} · rota {rotaNome || "—"}
              {enviarCards ? ` · Enviar cards ${enviarCards}` : ""}
            </span>
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setStep("venda")}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
            >
              <ShoppingBag className="h-4 w-4" />
              Somar com uma venda
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={confirmarCadastro}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar recuperação
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-lift">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500 text-white">
            <PackageSearch className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-extrabold text-slate-900">
              {isRecovery ? "Somar uma venda agora" : "Finalizar atendimento"}
            </h3>
            <p className="text-sm text-slate-500">{clienteNome}</p>
          </div>
        </div>
        {isRecovery && (
          <p className="mt-3 text-sm text-slate-500">
            Fechou pedido nessa ligação? Informe o código. Se não, volte e só confirme a recuperação.
          </p>
        )}
        <label className="mt-4 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
          Código do pedido (ERP)
        </label>
        <div className="mt-1 flex gap-2">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ex: 625864"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-avinor/40"
          />
          <button type="button" onClick={buscar} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-extrabold text-white">
            Buscar
          </button>
        </div>
        {hit?.found && (
          <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="font-extrabold">Encontrado no banco · {formatMoney(hit.valor_total)}</p>
            <p className="text-xs">
              {hit.itens?.length || 0} itens · {hit.status}
            </p>
          </div>
        )}
        {hit && !hit.found && (
          <p className="mt-3 text-sm text-amber-700">
            Esse código ainda não aparece no EXTRACTOR (só depois da entrega). Digite o valor total para registrar agora.
          </p>
        )}
        <label className="mt-4 block text-xs font-extrabold uppercase tracking-wide text-slate-400">Valor total</label>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-avinor/40"
        />
        {!!hit?.itens?.length && (
          <ul className="mt-3 max-h-40 overflow-auto text-xs text-slate-600">
            {hit.itens.map((it, i) => (
              <li key={i} className="flex justify-between border-t border-slate-100 py-1">
                <span className="truncate pr-2">{it.descricao}</span>
                <span className="font-bold">{formatMoney(it.valor)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={isRecovery ? () => setStep("aviso") : onCancel}
            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500"
          >
            {isRecovery ? "Voltar" : "Cancelar"}
          </button>
          <button
            type="button"
            disabled={loading || !codigo.trim()}
            onClick={salvarVenda}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRecovery ? "Registrar venda" : "Finalizar"}
          </button>
        </div>
      </div>
    </div>
  );
}
