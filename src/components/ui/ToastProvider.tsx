"use client";

import React, {createContext, useCallback, useContext, useMemo, useState} from "react";

type ToastKind = "success" | "error" | "info";
export type Toast = { id: string; kind: ToastKind; message: string; timeout?: number };

type Ctx = {
  push: (kind: ToastKind, message: string, timeout?: number) => void;
  success: (msg: string, timeout?: number) => void;
  error: (msg: string, timeout?: number) => void;
  info: (msg: string, timeout?: number) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export const useToast = (): Ctx => {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
};

export const ToastProvider: React.FC<React.PropsWithChildren> = ({children}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string, timeout = 4500) => {
    if (kind === "error") console.error("[Toast error]", message);
    const id = Math.random().toString(36).slice(2);
    setToasts(list => [...list, { id, kind, message, timeout }]);
    if (timeout && timeout > 0) {
      setTimeout(() => remove(id), timeout);
    }
  }, [remove]);

  const api = useMemo<Ctx>(() => ({
    push,
    success: (m, t) => push("success", m, t),
    error: (m, t) => push("error", m, t),
    info: (m, t) => push("info", m, t),
  }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Floating stack (top-right) */}
      <div className="fixed right-3 top-3 z-[1000] flex w-[min(92vw,400px)] flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={[
              "rounded-xl border px-3 py-2 shadow-md text-sm",
              "bg-white/90 dark:bg-slate-900/90 backdrop-blur",
              t.kind === "success" ? "border-emerald-300 dark:border-emerald-700" :
                t.kind === "error"   ? "border-rose-300 dark:border-rose-700" :
                  "border-slate-300 dark:border-slate-700"
            ].join(" ")}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5">
                {t.kind === "success" ? "✅" : t.kind === "error" ? "⚠️" : "💬"}
              </span>
              <div className="flex-1">{t.message}</div>
              <button
                className="opacity-60 hover:opacity-100"
                onClick={() => remove(t.id)}
                aria-label="Cerrar"
                title="Cerrar"
              >✕</button>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
