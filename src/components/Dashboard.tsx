"use client";
import {useAuth} from "@/lib/auth-context";
import {useUserCollections, money} from "@/lib/useCollections";
import {KIND_COLORS, KIND_LABELS} from "@/lib/types";

export default function Dashboard() {
  const {user} = useAuth();
  const {accounts, institutions, transactions, byCurrency} = useUserCollections(user?.uid);

  const accMap = new Map(accounts.map(a => [a.id, `${a.name} [${a.currency}]`]));

  return (
    <div className="grid gap-6">
      <div
        className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm opacity-70">Conectado como: {user?.email}</p>
        </div>
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

      <div
        className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h3 className="text-lg font-semibold mb-3">Cuentas por entidad</h3>
        <div className="grid gap-4">
          {institutions.length === 0 &&
              <div className="text-sm opacity-60">Aún no hay entidades/cuentas</div>}
          {institutions.map(inst => {
            const group = accounts.filter(a => a.institutionId === inst.id);
            const border = KIND_COLORS[inst.kind] || "border-slate-300 dark:border-slate-700";
            return (
              <div key={inst.id}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-4 rounded ${border} border`}/>
                  <div className="font-medium">
                    {inst.name} <span
                    className="text-xs opacity-60">{KIND_LABELS[inst.kind] || inst.kind}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.map(a => (
                    <div key={a.id}
                         className={`rounded-lg border ${border} p-3 bg-white dark:bg-slate-900 shadow-xs`}>
                      <div className="text-sm opacity-80">{a.name} <span
                        className="text-xs opacity-60">[{a.currency}]</span></div>
                      <div
                        className="text-xl font-semibold tabular-nums mt-1">{money(a.balance)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Transacciones recientes</h3>
          <span className="text-xs opacity-70">últimas 10</span>
        </div>
        <div className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
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
              <tr>
                <td colSpan={3} className="py-3 text-center opacity-60">Sin transacciones aún</td>
              </tr>
            )}
            {transactions.map(t => {
              const date = t.createdAt?.toDate?.() ? t.createdAt.toDate() : undefined;

              let kind = "Tx";
              let desc = "";
              let amount = 0;
              let currency = "";
              let isOut = false;

              switch (t.type) {
                case "transfer":
                  kind = "Transferencia";
                  desc = `${accMap.get(t.fromAccountId) ?? t.fromAccountId} → ${accMap.get(t.toAccountId) ?? t.toAccountId}`;
                  amount = t.amount; currency = t.currency; isOut = true;
                  break;
                case "fx":
                  kind = "Cambio";
                  desc = `${t.sellCurrency}→${t.buyCurrency} @${t.rate}`;
                  amount = t.buyAmount; currency = t.buyCurrency; isOut = false;
                  break;
                case "income":
                  kind = "Ingreso";
                  desc = accMap.get(t.accountId) ?? t.accountId;
                  amount = t.amount; currency = t.currency; isOut = false;
                  break;
              }

              return (
                <tr key={t.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-2 pr-4">
                    <span className="opacity-60">{kind}</span> · {desc}
                  </td>
                  <td className={`py-2 pr-4 text-right tabular-nums ${isOut ? "text-rose-600" : "text-emerald-600"}`}>
                    {money(amount)} {currency}
                  </td>
                  <td className="py-2 pl-4 text-xs opacity-60">
                    {date?.toLocaleString?.() || ""}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
