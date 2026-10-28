import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const KEY = "avinor_demo";
const CLOSES_KEY = "avinor_demo_closes";

export type DemoClose = {
  cliente_id: number;
  cliente_nome?: string;
  kind: string;
  motivo?: string;
  codigo?: string;
  valor?: number;
  origem?: "carteira" | "recuperacao";
  cidade?: string;
  at: string;
};

type Ctx = {
  mock: boolean;
  toggle: () => void;
  setMock: (v: boolean) => void;
  closes: Record<number, DemoClose>;
  recordClose: (close: DemoClose) => void;
};

const DemoCtx = createContext<Ctx | null>(null);

function read(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

function readCloses(): Record<number, DemoClose> {
  try {
    const raw = sessionStorage.getItem(CLOSES_KEY);
    return raw ? (JSON.parse(raw) as Record<number, DemoClose>) : {};
  } catch {
    return {};
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [mock, setMockState] = useState(read);
  const [closes, setCloses] = useState<Record<number, DemoClose>>(readCloses);
  const value = useMemo<Ctx>(
    () => ({
      mock,
      closes,
      setMock: (v) => {
        localStorage.setItem(KEY, v ? "1" : "0");
        setMockState(v);
      },
      toggle: () => {
        setMockState((cur) => {
          const next = !cur;
          localStorage.setItem(KEY, next ? "1" : "0");
          return next;
        });
      },
      recordClose: (close) => {
        setCloses((cur) => {
          const next = { ...cur, [close.cliente_id]: close };
          sessionStorage.setItem(CLOSES_KEY, JSON.stringify(next));
          return next;
        });
      },
    }),
    [mock, closes],
  );
  return <DemoCtx.Provider value={value}>{children}</DemoCtx.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoCtx);
  if (!ctx) throw new Error("DemoProvider ausente");
  return ctx;
}
