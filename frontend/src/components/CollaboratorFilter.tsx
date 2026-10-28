import { useAuth } from "../lib/auth";
import type { Colaboradora } from "../lib/types";
import { cn } from "../lib/utils";

type Props = {
  value: string;
  onChange: (id: string) => void;
  team?: Colaboradora[];
};

export function CollaboratorFilter({ value, onChange, team }: Props) {
  const { user } = useAuth();
  if (user?.role !== "adm") return null;
  const items = team?.length
    ? team
    : [
        { id: 1071, nome: "Poliana", login: "poliana" },
        { id: 1072, nome: "Fernanda", login: "fernanda" },
        { id: 1073, nome: "Karolline", login: "karolline" },
      ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Colaboradora</span>
      <button
        type="button"
        onClick={() => onChange("todas")}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-extrabold",
          value === "todas" ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
        )}
      >
        Todas
      </button>
      {items.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(String(c.id))}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-extrabold",
            value === String(c.id) ? "bg-avinor text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
          )}
        >
          {c.nome}
        </button>
      ))}
    </div>
  );
}
