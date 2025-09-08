"use client";

import React, {useEffect} from "react";

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

export default function Modal({open, title, onClose, children, footer, size="md"}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-3">
        <div className={`w-full ${sizeMap[size]} rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl`}>
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
            <h4 className="text-base font-semibold">{title}</h4>
            <button className="opacity-70 hover:opacity-100" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
          <div className="p-4">{children}</div>
          {footer && <div className="p-4 pt-0">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
