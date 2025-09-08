// src/components/Dashboard.tsx
"use client";

import {useEffect, useMemo, useState} from "react";
import {useAuth} from "@/lib/auth-context";
import {useUserCollections, money} from "@/lib/useCollections";
import {KIND_COLORS, KIND_LABELS, fmtDMYfromTs} from "@/lib/types";
import Modal from "@/components/ui/Modal";
import {onDuesForMonth} from "@/lib/spending";
import type {BillDue} from "@/lib/types";

/** =========================
 *   Mini Donut (SVG)
 * ========================= */
type DonutSlice = { value: number; label: string; color: string };
function MiniDonut({data, size = 64, stroke = 8}: { data: DonutSlice[]; size?: number; stroke?: number }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Composición por moneda">
      <g transform={`translate(${size / 2},${size / 2})`}>
        <circle r={r} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth={stroke}/>
        {total > 0 && data.map((d, i) => {
          const frac = Math.max(0, d.value) / total;
          const len = c * frac;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={i}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform="rotate(-90)"
            />
          );
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
}

/** Paleta requerida por el usuario */
const DONUT_COLORS = {
  ARS: "#38bdf8",            // celeste
  USD: "#10b981",            // verde
  CRYPTO: "#f59e0b",         // amarillo
  FINANCIAL: "#f97316",      // naranja
  CASH: "#a855f7",           // violeta (elección)
} as const;

/** Categorización por moneda / tipo de institución */
function categorizeBalance(
  currency: string,
  instKind: keyof typeof KIND_LABELS
): keyof typeof DONUT_COLORS {
  if (currency === "ARS") return "ARS";
  if (currency === "USD") return "USD";
  // crypto por ticker común
  if (["BTC", "ETH", "USDT", "USDC", "SOL"].includes(currency)) return "CRYPTO";
  // broker = financiero
  if (instKind === "broker") return "FINANCIAL";
  // efectivo por institución
  if (instKind === "cash") return "CASH";
  // por defecto, trata como financiero
  return "FINANCIAL";
}

/** =========================
 *   Dashboard
 * ========================= */
export default function Dashboard() {
  const {user} = useAuth();
  const uid = user?.uid ?? "";
  const {accounts, institutions, transactions, byCurrency} = useUserCollections(uid); // :contentReference[oaicite:4]{index=4}

  /** ====== Instituciones: tarjetas */
  type InstAgg = {
    instId: string;
    instName: string;
    instKind: keyof typeof KIND_LABELS;
    totals: Record<keyof typeof DONUT_COLORS, number>;
    grandTotal: number;
  };

  const instAggs: InstAgg[] = useMemo(() => {
    const map = new Map<string, InstAgg>();
    institutions.forEach(i => {
      map.set(i.id, {
        instId: i.id,
        instName: i.name,
        instKind: i.kind,
        totals: { ARS: 0, USD: 0, CRYPTO: 0, FINANCIAL: 0, CASH: 0 },
        grandTotal: 0,
      });
    });
    accounts.forEach(a => {
      const agg = map.get(a.institutionId);
      if (!agg) return;
      const cat = categorizeBalance(a.currency, agg.instKind);
      agg.totals[cat] += a.balance || 0;
      agg.grandTotal += a.balance || 0;
    });
    return Array.from(map.values()).sort((a, b) => a.instName.localeCompare(b.instName));
  }, [accounts, institutions]);

  /** ====== Modal de institución */
  const [openInst, setOpenInst] = useState<InstAgg | null>(null);

  /** ====== Transacciones recientes — colapsable */
  const [showTx, setShowTx] = useState(false);

  /** ====== Gastos del mes */
  const [dues, setDues] = useState<BillDue[]>([]);
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (!uid) return;
    const unsub = onDuesForMonth(uid, month, setDues, (e) => console.error(e)); // patrón igual que en spending :contentReference[oaicite:5]{index=5}
    return () => unsub();
  }, [uid, month]);

  const duesGroups = useMemo(() => {
    const paid: BillDue[] = [];
    const unpaid: BillDue[] = [];
    let totalPlanned = 0, totalPaid = 0;

    dues.forEach(d => {
      totalPlanned += d.amountPlanned || 0;
      totalPaid += d.amountPaid || 0;
      const remain = Math.max(0, (d.amountPlanned || 0) - (d.amountPaid || 0));
      if (remain <= 0) paid.push(d); else unpaid.push(d);
    });

    const totalRemain = Math.max(0, totalPlanned - totalPaid);
    return { paid, unpaid, totalPlanned, totalPaid, totalRemain };
  }, [dues]);

  /** ====== Mapa de cuentas (corrige tipos undefined) */
  const accMap = useMemo(() => new Map(accounts.map(a => [a.id, `${a.name} [${a.currency}]`])), [accounts]);

  return (
    <div className="grid gap-6">
      {/* ====== Caja 1: tarjetas por institución ====== */}
      <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm opacity-70">Conectado como: {user?.email}</p>
        </div>

        <div className="grid gap-3"
             style={{gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))"}}>
          {instAggs.length === 0 && <div className="text-sm opacity-60">Sin cuentas para resumir</div>}
          {instAggs.map(agg => {
            const border = KIND_COLORS[agg.instKind] || "border-slate-300 dark:border-slate-700";
            const donutData: DonutSlice[] = [
              { label: "ARS",       value: agg.totals.ARS,       color: DONUT_COLORS.ARS },
              { label: "USD",       value: agg.totals.USD,       color: DONUT_COLORS.USD },
              { label: "Cripto",    value: agg.totals.CRYPTO,    color: DONUT_COLORS.CRYPTO },
              { label: "Finanzas",  value: agg.totals.FINANCIAL, color: DONUT_COLORS.FINANCIAL },
              { label: "Efectivo",  value: agg.totals.CASH,      color: DONUT_COLORS.CASH },
            ];

            return (
              <button
                key={agg.instId}
                onClick={() => setOpenInst(agg)}
                className={`group rounded-xl border ${border} bg-white dark:bg-slate-900 shadow-sm p-4 text-left focus:outline-none hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition`}
                style={{height: 140}}
                title={agg.instName}
                aria-label={`Abrir ${agg.instName}`}
              >
                <div className="flex items-start gap-3">
                  <MiniDonut data={donutData}/>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-3xl" style={{maxWidth: 260}}>{agg.instName}</div>
                    <div className="text-sm opacity-70">{KIND_LABELS[agg.instKind]}</div>
                    <div className="text-xl font-semibold tabular-nums mt-1">
                      {money(agg.grandTotal)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] opacity-80">
                      {donutData.filter(d=>d.value>0).map(d => (
                        <span key={d.label} className="inline-flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded" style={{background:d.color}}/>
                          {d.label}: {money(d.value)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal de institución */}
      <Modal
        open={!!openInst}
        onClose={() => setOpenInst(null)}
        title={openInst ? `${openInst.instName} — ${KIND_LABELS[openInst.instKind]}` : ""}
        size="lg"
      >
        {openInst && (
          <div className="grid gap-4">
            <div className="flex items-center gap-4">
              <MiniDonut data={[
                { label: "ARS",       value: openInst.totals.ARS,       color: DONUT_COLORS.ARS },
                { label: "USD",       value: openInst.totals.USD,       color: DONUT_COLORS.USD },
                { label: "Cripto",    value: openInst.totals.CRYPTO,    color: DONUT_COLORS.CRYPTO },
                { label: "Finanzas",  value: openInst.totals.FINANCIAL, color: DONUT_COLORS.FINANCIAL },
                { label: "Efectivo",  value: openInst.totals.CASH,      color: DONUT_COLORS.CASH },
              ]} size={88} stroke={10}/>
              <div>
                <div className="text-sm opacity-70">Total</div>
                <div className="text-2xl font-semibold tabular-nums">{money(openInst.grandTotal)}</div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Cuentas</h4>
              <div className="grid gap-2">
                {accounts.filter(a => a.institutionId === openInst.instId)
                  .sort((a,b)=>a.name.localeCompare(b.name))
                  .map(a => (
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
          </div>
        )}
      </Modal>

      {/* ====== Caja 2: Transacciones recientes (colapsable) ====== */}
      <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Transacciones recientes</h3>
            <span className="text-xs opacity-70">últimas 10</span>
          </div>
          <button
            type="button"
            onClick={() => setShowTx(v => !v)}
            aria-expanded={showTx}
            aria-controls="recent-tx"
            className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
          >
            {showTx ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        <div id="recent-tx" hidden={!showTx} className="mt-3 overflow-x-auto">
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
            {transactions.map(t => {
              // corrección de tipos: ids pueden ser undefined -> normalizar a ""
              const fromId = t.fromAccountId ?? "";
              const toId   = t.toAccountId ?? "";
              const acctId = t.accountId ?? "";
              const date = t.createdAt?.toDate?.() ? t.createdAt.toDate() : undefined;

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

      {/* ====== Caja 3: Gastos del mes ====== */}
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
              onChange={e => setMonth(e.target.value)}
              className="rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
            />
          </label>
        </div>

        {/* Totales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs opacity-70">Plan del mes</div>
            <div className="text-xl font-semibold tabular-nums">{money(duesGroups.totalPlanned)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs opacity-70">Pagado</div>
            <div className="text-xl font-semibold tabular-nums text-emerald-600">{money(duesGroups.totalPaid)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs opacity-70">Restante</div>
            <div className="text-xl font-semibold tabular-nums text-amber-600">{money(duesGroups.totalRemain)}</div>
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
                {duesGroups.unpaid.map(d => {
                  const plan = d.amountPlanned || 0;
                  const paid = d.amountPaid || 0;
                  const rem = Math.max(0, plan - paid);
                  const dueDate = d.dueDate?.toDate?.() ? d.dueDate.toDate() : undefined;

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
                {duesGroups.unpaid.length === 0 && (
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
                {duesGroups.paid.map(d => {
                  const plan = d.amountPlanned || 0;
                  const paid = d.amountPaid || 0;
                  const dueDate = d.dueDate?.toDate?.() ? d.dueDate.toDate() : undefined;
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
                {duesGroups.paid.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center opacity-60">Sin pagos aún</td></tr>
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ====== Caja extra: resumen por moneda (ya tenías) ====== */}
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
