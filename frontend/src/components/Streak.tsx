import { Flame } from "lucide-react";
import { cn } from "../lib/utils";

export function Streak({ value }: { value?: number }) {
  const n = value || 0;
  if (n <= 0) return null;
  const hot = n >= 4;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
        hot ? "bg-orange-50 text-orange-600" : "bg-amber-50 text-amber-700",
      )}
      title={`${n} semanas seguidas comprando`}
    >
      <Flame className={cn("h-3 w-3", hot ? "fill-orange-500 text-orange-500" : "text-amber-500")} />
      {n}
    </span>
  );
}
