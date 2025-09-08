// src/components/dashboard/MonthlyExpensesSection.tsx
"use client";

import { fmtDMYfromTs, money } from "@/lib/types";
import type { MonthlyExpensesSectionProps, BillDue } from "@/lib/types";
import { useMemo } from "react";

export default function MonthlyExpensesSection({
                                                 dues,
                                                 month,
                                                 onChangeMonth,
                                               }: MonthlyExpensesSectionProps) {
  const groups = useMemo(() => {
    const paid: BillDue[] = [];
    const unpaid: BillDue[] = [];
    let totalPlanned = 0;
    let totalPaid = 0;

    dues.forEach((d: BillDue) => {
      totalPlanned += d.amountPlanned || 0;
      totalPaid += d.amountPaid || 0;
      const remain = Math.max(0, (d.amountPlanned || 0) - (d.amountPaid || 0));
      if (remain <= 0) paid.push(d); else unpaid.push(d);
    });

    const totalRemain = Math.max(0, totalPlanned - totalPaid);
    return { paid, unpaid, totalPlanned, totalPaid, totalRemain };
  }, [dues]);

  return (
    <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold">Gastos del mes</h3>
          <p className="text-xs opacity-60">Agrupados por pagados e impagos</p>
        </div>
        <label className="text-sm flex items-center gap-2">
          <span>Mes</span>
          <input
            type="month"
            value={month}
            onChange={(e) => onChangeMonth(e.target.value)}
            className="rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
          />
        </label>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
          <div className="text-xs opacity-70">Plan del mes</div>
          <div className="text-xl font-semibold tabular-nums">{money(groups.totalPlanned)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
          <div className="text-xs opacity-70">Pagado</div>
          <div className="text-xl font-semibold tabular-nums text-emerald-600">{money(groups.totalPaid)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
          <div className="text-xs opacity-70">Restante</div>
          <div className="text-xl font-semibold tabular-nums text-amber-600">{money(groups.totalRemain)}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Impagos */}
        <div>
          <h4 className="font-medium mb-2">Impagos</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left opacity-70">
              <tr>
                <th className="py-2 pr-4">Gasto</th>
                <th className="py-2 pr-4">Vence</th>
                <th className="py-2 pr-4 text-right">Plan</th>
                <th className="py-2 pr-4 text-right">Pagado</th>
                <th className="py-2 pl-4 text-right">Restante</th>
              </tr>
              </thead>
              <tbody>
              {groups.unpaid.map((d: BillDue) => {
                const plan = d.amountPlanned || 0;
                const paid = d.amountPaid || 0;
                const rem = Math.max(0, plan - paid);
                const hasDate: boolean = typeof d.dueDate?.toDate === "function";
                const dueDate: Date | undefined = hasDate ? d.dueDate.toDate() : undefined;

                // alerta si faltan 3 días o menos
                let alertCls = "";
                if (dueDate) {
                  const days = Math.ceil((+dueDate - Date.now()) / (1000 * 60 * 60 * 24));
                  if (days <= 3) alertCls = "bg-amber-50 dark:bg-amber-900/20";
                }

                return (
                  <tr key={d.id} className={`border-t border-slate-200 dark:border-slate-800 ${alertCls}`}>
                    <td className="py-2 pr-4">
                      <div className="truncate">{d.title}</div>
                      <div className="text-xs opacity-60">[{d.currency}]</div>
                    </td>
                    <td className="py-2 pr-4">{dueDate ? fmtDMYfromTs(dueDate) : "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(plan)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(paid)}</td>
                    <td className="py-2 pl-4 text-right tabular-nums">{money(rem)}</td>
                  </tr>
                );
              })}
              {groups.unpaid.length === 0 && (
                <tr><td colSpan={5} className="py-3 text-center opacity-60">Sin impagos 🎉</td></tr>
              )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagados */}
        <div>
          <h4 className="font-medium mb-2">Pagados</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left opacity-70">
              <tr>
                <th className="py-2 pr-4">Gasto</th>
                <th className="py-2 pr-4">Venció</th>
                <th className="py-2 pr-4 text-right">Plan</th>
                <th className="py-2 pr-4 text-right">Pagado</th>
              </tr>
              </thead>
              <tbody>
              {groups.paid.map((d: BillDue) => {
                const plan = d.amountPlanned || 0;
                const paid = d.amountPaid || 0;
                const hasDate: boolean = typeof d.dueDate?.toDate === "function";
                const dueDate: Date | undefined = hasDate ? d.dueDate.toDate() : undefined;
                return (
                  <tr key={d.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-2 pr-4">
                      <div className="truncate">{d.title}</div>
                      <div className="text-xs opacity-60">[{d.currency}]</div>
                    </td>
                    <td className="py-2 pr-4">{dueDate ? fmtDMYfromTs(dueDate) : "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(plan)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">{money(paid)}</td>
                  </tr>
                );
              })}
              {groups.paid.length === 0 && (
                <tr><td colSpan={4} className="py-3 text-center opacity-60">Sin pagos aún</td></tr>
              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
