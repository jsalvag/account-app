"use client";
import {useAuth} from "@/lib/auth-context";
import {useUserCollections, money} from "@/lib/useCollections";
import {KIND_COLORS, KIND_LABELS} from "@/lib/types";

export default function Dashboard() {
  const {user} = useAuth();
  const {accounts, institutions, transactions, byCurrency} = useUserCollections(user?.uid);

  // Map rápido para nombres de cuenta
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
          {transactions.length === 0 &&
              <div className="text-sm opacity-60 py-2">Sin transacciones aún</div>}
          {transactions.map(t => {
            const date = t.createdAt?.toDate?.() ? t.createdAt.toDate() : undefined;
            const kind = t.type === "transfer" ? "Transferencia" : (t.type === "fx" ? "Cambio" : t.type);
            const signOut = t.type === "transfer" || (t as any).sellAmount != null;
            const amt = (t as any).amount ?? (t as any).buyAmount ?? 0;
            const curr = (t as any).currency ?? (t as any).buyCurrency ?? "";
            const desc = t.type === "transfer"
              ? `${accMap.get((t as any).fromAccountId) || (t as any).fromAccountId} → ${accMap.get((t as any).toAccountId) || (t as any).toAccountId}`
              : `${(t as any).sellCurrency || ""}→${(t as any).buyCurrency || ""} @${(t as any).rate || ""}`;
            return (
              <div key={t.id} className="py-2 flex items-center justify-between">
                <div className="text-sm"><span className="opacity-60">{kind}</span> · {desc}</div>
                <div
                  className={`text-sm tabular-nums ${signOut ? "text-rose-600" : "text-emerald-600"}`}>{money(amt)} {curr}</div>
                <div className="text-[11px] opacity-60 ml-3">{date?.toLocaleString?.() || ""}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
