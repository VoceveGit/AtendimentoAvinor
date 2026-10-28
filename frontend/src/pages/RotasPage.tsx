import { MapPin, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn, formatDate } from "../lib/utils";

type Day = {
  date: string;
  weekday: number;
  is_today: boolean;
  clientes: number;
  routes: {
    id: string;
    nome: string;
    clientes: number;
    enviar_cards?: string;
    saida_carga?: string;
    cidades?: string[];
  }[];
};

const NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function RotasPage() {
  const [days, setDays] = useState<Day[]>([]);

  useEffect(() => {
    api<{ days: Day[] }>("/api/routes/week").then((r) => setDays(r.days)).catch(() => undefined);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {days.map((day) => (
        <article
          key={day.date}
          className={cn(
            "rounded-2xl border bg-white p-5 shadow-card",
            day.is_today ? "border-avinor ring-1 ring-avinor/30" : "border-slate-100",
          )}
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-400">{formatDate(day.date)}</p>
              <h3 className="font-display text-2xl font-bold text-slate-900">{NAMES[day.weekday]}</h3>
            </div>
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600">
              {day.clientes} clientes
            </span>
          </div>
          <ul className="space-y-2">
            {day.routes.length === 0 && <li className="text-sm text-slate-400">Sem cards neste dia.</li>}
            {day.routes.map((r) => (
              <li key={r.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <MapPin className="h-3.5 w-3.5 text-orange-500" />
                    {r.nome}
                  </span>
                  <span className="text-[11px] font-extrabold text-slate-400">{r.clientes} cl.</span>
                </div>
                {!!r.cidades?.length && (
                  <p className="mt-1 pl-6 text-[11px] font-bold leading-snug text-slate-400">
                    {r.cidades.join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <UserRound className="h-3.5 w-3.5" />
            Atendimento comercial · Enviar cards
          </p>
        </article>
      ))}
    </div>
  );
}
