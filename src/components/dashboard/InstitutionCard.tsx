// src/components/dashboard/InstitutionCard.tsx
"use client";

import {
  KIND_COLORS,
  KIND_LABELS,
  money,
  type InstitutionCardProps,
} from "@/lib/types";

export default function InstitutionCard({ agg, onOpen }: InstitutionCardProps) {
  const borderClass: string = KIND_COLORS[agg.instKind] || "border-slate-300 dark:border-slate-700";

  return (
    <button
      onClick={() => onOpen(agg)}
      className={`group rounded-xl border ${borderClass} bg-white dark:bg-slate-900 shadow-sm p-4 text-left focus:outline-none hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition`}
      style={{height: 160}}
      title={agg.instName}
      aria-label={`Abrir ${agg.instName}`}
    >
      <div className="flex items-start gap-3">
        {/* sin dona */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate" style={{maxWidth: 260}}>{agg.instName}</div>
          <div className="text-xs opacity-70">{KIND_LABELS[agg.instKind]}</div>

          {/* montos por moneda (suma dentro de la misma moneda) */}
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
            {Array.from(agg.perCurrency.entries())
              .sort(([a],[b]) => a.localeCompare(b))
              .map(([cur, amount]) => (
                <div key={cur} className="flex items-center justify-between text-sm">
                  <span className="opacity-70">{cur}</span>
                  <span className="tabular-nums">{money(amount)}</span>
                </div>
              ))}
            {agg.perCurrency.size === 0 && (
              <div className="text-sm opacity-60 col-span-2">Sin cuentas en esta entidad.</div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
