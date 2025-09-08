// src/components/dashboard/TransactionsSection.tsx
"use client";

import { fmtDMYfromTs, money } from "@/lib/types";
import type { TransactionsSectionProps } from "@/lib/types";
import { useMemo, useState } from "react";

export default function TransactionsSection({
                                              transactions,
                                              accounts,
                                              title = "Transacciones recientes",
                                              limit = 10,
                                              collapsedByDefault = true,
                                            }: TransactionsSectionProps) {
  const [open, setOpen] = useState<boolean>(!collapsedByDefault);
  const accMap = useMemo<Map<string, string>>(
    () => new Map<string, string>(accounts.map(a => [a.id, `${a.name} [${a.currency}]`])),
    [accounts]
  );

  return (
    <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <span className="text-xs opacity-70">últimas {limit}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-controls="recent-tx"
          className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
        >
          {open ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      <div id="recent-tx" hidden={!open} className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left opacity-70 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="py-2 pr-4">Tipo / Descripción</th>
            <th className="py-2 pr-4 text-right">Monto</th>
            <th className="py-2 pl-4">Fecha</th>
          </tr>
          </thead>
          <tbody>
          {transactions.length === 0 && (
            <tr><td colSpan={3} className="py-3 text-center opacity-60">Sin transacciones aún</td></tr>
          )}
          {transactions.slice(0, limit).map((t) => {
            const fromId: string = t.fromAccountId ?? "";
            const toId: string = t.toAccountId ?? "";
            const acctId: string = t.accountId ?? "";
            const hasDate: boolean = typeof t.createdAt?.toDate === "function";
            const date: Date | undefined = hasDate ? t.createdAt.toDate() : undefined;

            let kind = "Tx";
            let desc = "";
            let amount = 0;
            let currency = "";
            let isOut = false;

            switch (t.type) {
              case "transfer":
                kind = "Transferencia";
                desc = `${accMap.get(fromId) ?? fromId} → ${accMap.get(toId) ?? toId}`;
                amount = t.amount ?? 0; currency = t.currency ?? ""; isOut = true;
                break;
              case "fx":
                kind = "Cambio";
                desc = `${t.sellCurrency ?? ""}→${t.buyCurrency ?? ""} @${t.rate ?? ""}`;
                amount = t.buyAmount ?? 0; currency = t.buyCurrency ?? ""; isOut = false;
                break;
              case "income":
                kind = "Ingreso";
                desc = accMap.get(acctId) ?? acctId;
                amount = t.amount ?? 0; currency = t.currency ?? ""; isOut = false;
                break;
              default:
                desc = accMap.get(acctId) ?? acctId;
                amount = t.amount ?? 0; currency = t.currency ?? "";
            }

            return (
              <tr key={t.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2 pr-4">
                  <span className="opacity-60">{kind}</span> · {desc}
                </td>
                <td className={`py-2 pr-4 text-right tabular-nums ${isOut ? "text-rose-600" : "text-emerald-600"}`}>
                  {money(amount)} {currency}
                </td>
                <td className="py-2 pl-4">{date ? fmtDMYfromTs(date) : "—"}</td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
