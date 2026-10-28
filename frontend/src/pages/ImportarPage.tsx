import { FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";

type Field = { id: string; label: string };
type Preview = {
  filename: string;
  header_row: number;
  headers: string[];
  mapping: Record<string, string>;
  suggested_mapping: Record<string, string>;
  reused: boolean;
  preview: Record<string, unknown>[];
  total_rows: number;
  signature: string;
};

export function ImportarPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    api<{ fields: Field[] }>("/api/import/fields").then((r) => setFields(r.fields));
  }, []);

  const upload = async (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    try {
      const data = await api<Preview>("/api/import/preview", { method: "POST", body: fd });
      setFile(f);
      setPreview(data);
      setMapping(data.mapping || data.suggested_mapping);
      setStep(2);
      if (data.reused) toast.success("Mapeamento anterior reaplicado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const confirm = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapping", JSON.stringify(mapping));
    try {
      await api("/api/import/xlsx", { method: "POST", body: fd });
      toast.success("Importação registrada.");
      setStep(3);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <ol className="flex items-center gap-3 text-sm">
        <Step n={1} label="Upload do arquivo" active={step >= 1} done={step > 1} />
        <span className="text-slate-300">›</span>
        <Step n={2} label="Mapear colunas" active={step >= 2} done={step > 2} />
        <span className="text-slate-300">›</span>
        <Step n={3} label="Preview & confirmar" active={step >= 3} done={step > 3} />
      </ol>

      {step === 1 && (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-slate-500 hover:border-avinor/40">
          <Upload className="mb-3 h-8 w-8" />
          <p className="font-medium">Solte o .xlsx aqui ou clique para escolher</p>
          <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      )}

      {preview && step >= 2 && (
        <>
          <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="font-semibold">{preview.filename}</p>
                <p className="text-xs text-slate-400">
                  {preview.total_rows} linhas · {preview.headers.length} colunas · títulos na linha {preview.header_row}
                </p>
              </div>
            </div>
            <button type="button" className="text-sm text-slate-500" onClick={() => setStep(1)}>
              Trocar arquivo
            </button>
          </div>
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display font-semibold">Mapeamento de colunas</h3>
              <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600">Detecção dinâmica</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {preview.headers.map((h) => (
                <div key={h} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Coluna da planilha</p>
                  <p className="font-semibold text-slate-800">{h}</p>
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    value={mapping[h] || "ignorar"}
                    onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                  >
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h3 className="mb-3 font-display font-semibold">Pré-visualização ({preview.preview.length} de {preview.total_rows} linhas)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase text-emerald-700">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} className="px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {preview.headers.map((h) => (
                        <td key={h} className="px-3 py-2 text-slate-600">{String(row[h] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-lg px-4 py-2 text-sm text-slate-500">Cancelar</button>
            <button type="button" onClick={confirm} className="rounded-lg bg-avinor px-4 py-2 text-sm font-semibold text-white">
              Confirmar importação
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${active ? "text-slate-900" : "text-slate-400"}`}>
      <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${done || active ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
        {n}
      </span>
      {label}
    </li>
  );
}
