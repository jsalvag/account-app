// src/components/Dashboard.tsx
"use client";

import {useEffect, useMemo, useState} from "react";
import {useAuth} from "@/lib/auth-context";
import {useUserCollections} from "@/lib/useCollections";
import Modal from "@/components/ui/Modal";
import {onDuesForMonth} from "@/lib/spending";

import {
  type InstitutionKind,
  isCryptoTicker,
  KIND_LABELS,
  money,
  fmtDMYfromTs,
  type BillDue,
  type InstAgg,
} from "@/lib/types";

import InstitutionCard from "./dashboard/InstitutionCard";
import TransactionsSection from "./dashboard/TransactionsSection";
import MonthlyExpensesSection from "./dashboard/MonthlyExpensesSection";

/** ===========
 *  Dashboard
 * =========== */
export default function Dashboard() {
  const {user} = useAuth();
  const uid: string = user?.uid ?? "";

  const {accounts, institutions, transactions, byCurrency} = useUserCollections(uid);

  /** Agregación por institución SIN mezclar monedas */
  const instAggs: InstAgg[] = useMemo<InstAgg[]>(() => {
    const map = new Map<string, InstAgg>();

    institutions.forEach((i) => {
      map.set(i.id, {
        instId: i.id,
        instName: i.name,
        instKind: i.kind as InstitutionKind,
        perCurrency: new Map<string, number>(),
        perCrypto: new Map<string, number>(),
      });
    });

    accounts.forEach((a) => {
      const agg = map.get(a.institutionId);
      if (!agg) return;
      const prev: number = agg.perCurrency.get(a.currency) ?? 0;
      agg.perCurrency.set(a.currency, prev + (a.balance || 0));

      // cripto detallado (sin mezclar cross-coin)
      const up: string = a.currency.toUpperCase();
      if (isCryptoTicker(up)) {
        const prevCrypto: number = agg.perCrypto.get(up) ?? 0;
        agg.perCrypto.set(up, prevCrypto + (a.balance || 0));
      }
    });

    return Array.from(map.values()).sort((a, b) => a.instName.localeCompare(b.instName));
  }, [accounts, institutions]);

  /** Modal por institución */
  const [openInst, setOpenInst] = useState<InstAgg | null>(null);

  /** Gastos del mes */
  const [dues, setDues] = useState<BillDue[]>([]);
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (!uid) return;
    const unsub = onDuesForMonth(uid, month, setDues, (e: unknown) => console.error(e));
    return () => unsub();
  }, [uid, month]);

  /** Mapa de cuentas para descripciones en el modal */
  const accMap = useMemo<Map<string, string>>(
    () => new Map<string, string>(accounts.map(a => [a.id, `${a.name} [${a.currency}]`])),
    [accounts]
  );

  return (
    <div className="grid gap-6">
      {/* ====== Caja: tarjetas por institución ====== */}
      <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm opacity-70">Conectado como: {user?.email}</p>
        </div>

        <div className="grid gap-3" style={{gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))"}}>
          {instAggs.length === 0 && <div className="text-sm opacity-60">Sin cuentas para resumir</div>}
          {instAggs.map((agg) => (
            <InstitutionCard key={agg.instId} agg={agg} onOpen={setOpenInst}/>
          ))}
        </div>
      </div>

      {/* Modal de institución */}
      <Modal
        open={!!openInst}
        onClose={() => setOpenInst(null)}
        title={openInst ? `${openInst.instName}` : ""}
        size="lg"
      >
        {openInst && (
          <div className="grid gap-4">
            {/* Composición por moneda/ticker */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-xs opacity-70 mb-2">Por moneda</div>
                <div className="grid gap-1">
                  {Array.from(openInst.perCurrency.entries())
                    .sort(([a],[b]) => a.localeCompare(b))
                    .map(([cur, amount]) => (
                      <div key={cur} className="flex items-center justify-between text-sm">
                        <span className="opacity-70">{cur}</span>
                        <span className="tabular-nums">{money(amount)}</span>
                      </div>
                    ))}
                  {openInst.perCurrency.size === 0 && (
                    <div className="text-sm opacity-60">Sin datos</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-xs opacity-70 mb-2">Cripto (por ticker)</div>
                <div className="grid gap-1">
                  {Array.from(openInst.perCrypto.entries())
                    .sort(([a],[b]) => a.localeCompare(b))
                    .map(([ticker, amount]) => (
                      <div key={ticker} className="flex items-center justify-between text-sm">
                        <span className="opacity-70">{ticker}</span>
                        <span className="tabular-nums">{money(amount)}</span>
                      </div>
                    ))}
                  {openInst.perCrypto.size === 0 && (
                    <div className="text-sm opacity-60">Sin cripto</div>
                  )}
                </div>
              </div>
            </div>

            {/* Cuentas de la entidad */}
            <div>
              <h4 className="font-medium mb-2">Cuentas</h4>
              <div className="grid gap-2">
                {accounts.filter(a => a.institutionId === openInst.instId)
                  .sort((a,b)=>a.name.localeCompare(b.name))
                  .map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <div className="opacity-80">{a.name} <span className="opacity-60">[{a.currency}]</span></div>
                      <div className="tabular-nums">{money(a.balance)}</div>
                    </div>
                  ))}
                {accounts.filter(a => a.institutionId === openInst.instId).length === 0 && (
                  <div className="text-sm opacity-60">Sin cuentas en esta entidad.</div>
                )}
              </div>
            </div>

            {/* Transacciones (últimas 10) de la entidad */}
            <div>
              <h4 className="font-medium mb-2">Transacciones</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left opacity-70">
                  <tr>
                    <th className="py-2 pr-4">Tipo / Descripción</th>
                    <th className="py-2 pr-4 text-right">Monto</th>
                    <th className="py-2 pl-4">Fecha</th>
                  </tr>
                  </thead>
                  <tbody>
                  {(() => {
                    const ids = new Set<string>(accounts.filter(a=>a.institutionId===openInst.instId).map(a=>a.id));
                    return transactions
                      .filter(t => ids.has(t.accountId ?? "") || ids.has(t.fromAccountId ?? "") || ids.has(t.toAccountId ?? ""))
                      .slice(0,10)
                      .map((t) => {
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
                      });
                  })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ====== Caja: Transacciones recientes (colapsable por defecto) ====== */}
      <TransactionsSection
        transactions={transactions}
        accounts={accounts}
        collapsedByDefault={true}
        limit={10}
      />

      {/* ====== Caja: Gastos del mes ====== */}
      <MonthlyExpensesSection
        dues={dues}
        month={month}
        onChangeMonth={setMonth}
      />

      {/* ====== Caja extra: resumen por moneda (existente) ====== */}
      <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h3 className="text-lg font-semibold mb-3">Resumen por moneda</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Object.keys(byCurrency).length === 0 && (
            <div className="text-sm opacity-60">Sin cuentas para resumir</div>
          )}
          {Object.entries(byCurrency).sort().map(([c, v]) => (
            <div key={c}
                 className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900 shadow-sm">
              <div className="text-xs opacity-70 mb-1">{c}</div>
              <div className="text-2xl font-semibold tabular-nums">{money(v)}</div>
              <div className="text-[11px] opacity-60">Total en {c}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
