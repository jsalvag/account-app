"use client";

import React, {createContext, useCallback, useContext, useMemo, useState} from "react";

type Ctx = {
  pending: boolean;
  run<T>(fn: () => Promise<T>): Promise<T>;
  start(): void;
  stop(): void;
};

const PendingCtx = createContext<Ctx | null>(null);

export function usePending(): Ctx {
  const ctx = useContext(PendingCtx);
  if (!ctx) throw new Error("usePending must be used within <PendingProvider>");
  return ctx;
}

export const PendingProvider: React.FC<React.PropsWithChildren> = ({children}) => {
  const [count, setCount] = useState(0);
  const pending = count > 0;

  const start = useCallback(() => setCount(c => c + 1), []);
  const stop = useCallback(() => setCount(c => Math.max(0, c - 1)), []);

  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    start();
    try {
      return await fn();
    } finally {
      stop();
    }
  }, [start, stop]);

  const value = useMemo<Ctx>(() => ({pending, run, start, stop}), [pending, run, start, stop]);

  return (
    <PendingCtx.Provider value={value}>
      <div aria-busy={pending ? "true" : "false"}>
        {children}
      </div>

      {/* Overlay que bloquea toda la app mientras hay requests */}
      {pending && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          role="status" aria-label="Cargando…"
        >
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-4 py-3 shadow-lg">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <span className="text-sm">Procesando…</span>
            </div>
          </div>
        </div>
      )}
    </PendingCtx.Provider>
  );
};
