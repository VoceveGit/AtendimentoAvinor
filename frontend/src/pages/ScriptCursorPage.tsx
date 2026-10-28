import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";

export function ScriptCursorPage() {
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ content: string }>("/api/prompt").then((r) => setContent(r.content)).catch((e: Error) => toast.error(e.message));
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Prompt copiado.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-lg bg-avinor px-3 py-1.5 text-sm font-semibold text-white">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Copiar
        </button>
      </div>
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-5 font-mono text-xs leading-relaxed text-slate-100">
        {content || "Carregando..."}
      </pre>
    </div>
  );
}
