"use client";

import {JSX, useEffect, useMemo, useState} from "react";
import {useAuth} from "@/lib/auth-context";
import {useUserCollections} from "@/lib/useCollections";
import {BILL_KIND_LABELS, BillDue, KIND_LABELS, money, RecurringBill} from "@/lib/types";
import {
  createRecurringBill, deleteRecurringBill,
  generateMonthDues,
  onBills,
  onDuesForMonth,
  payDue, updateRecurringBill
} from "@/lib/spending";
import {AmountType, amountTypes, currencies, Currency} from "@/lib/converters";

// --- Helpers de fecha para dueDate (soporta Date y Timestamp-like) ---
type TimestampLike = { toDate: () => Date };

const isTimestampLike = (v: unknown): v is TimestampLike => {
  return typeof v === "object" && v !== null && "toDate" in v && typeof (v as TimestampLike).toDate === "function";
};

const formatDueDate = (v: unknown): string => {
  if (!v) return "";
  const d: Date = isTimestampLike(v) ? v.toDate() : (v as Date);
  return d.toLocaleDateString();
};

const monthKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

const SpendingPage = (): JSX.Element => {
  const {user} = useAuth();
  const uid = user?.uid ?? "";
  const {accounts, institutions} = useUserCollections(uid);

  // UI state
  const [err, setErr] = useState<string>("");
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [dues, setDues] = useState<BillDue[]>([]);
  const [month, setMonth] = useState<string>(monthKey(new Date()));

  // Form: add bill
  const [title, setTitle] = useState<string>("");
  const [currency, setCurrency] = useState<string>("ARS");
  const [amountType, setAmountType] = useState<RecurringBill["amountType"]>("fixed");
  const [amount, setAmount] = useState<number | "">("");
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [defaultAccountId, setDefaultAccountId] = useState<string>("");

  // UI: toggle sección plantillas
  const [templatesOpen, setTemplatesOpen] = useState<boolean>(false);

  // subscribe
  useEffect(() => {
    if (!uid) return;
    const unsubBills = onBills(uid, setBills, setErr);
    const unsubDues = onDuesForMonth(uid, month, setDues, setErr);
    return () => {
      unsubBills();
      unsubDues();
    };
  }, [uid, month]);

  const onAddBill = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      if (!uid || !title.trim()) return;
      const payload = {
        title: title.trim(),
        currency,
        amountType,
        amount: amount === "" ? undefined : Number(amount),
        dayOfMonth: Math.max(1, Math.min(28, dayOfMonth)),
        defaultAccountId: defaultAccountId || undefined,
        active: true,
      } as const;
      await createRecurringBill(uid, payload);
      setTitle("");
      setAmount("");
      setDayOfMonth(1);
      setDefaultAccountId("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const onGenerate = async (): Promise<void> => {
    try {
      if (!uid) return;
      const created = await generateMonthDues(uid, month);
      setErr(created > 0 ? `Generados ${created} vencimientos.` : "No había nada para generar.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      console.error(e);
    }
  };

  const onPay = async (dueId: string, accountId: string, amountStr: string): Promise<void> => {
    try {
      if (!accountId) {
        setErr("Selecciona una cuenta para pagar.");
        return;
      }
      const amountNum = Number(amountStr);
      if (!(amountNum > 0)) {
        setErr("Ingresa un monto válido.");
        return;
      }
      await payDue(uid, dueId, accountId, amountNum);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  // Mapa de institución → nombre / etiqueta con tipo
  const instLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    institutions.forEach(i => {
      const kind = KIND_LABELS[i.kind] ?? i.kind;
      m.set(i.id, `${i.name} — ${kind}`);
    });
    return m;
  }, [institutions]);

  // Helper para renderizar <optgroup> agrupado por entidad (con filtro de moneda opcional)
  const renderAccountOptgroups = (currency?: string): JSX.Element[] => {
    // agrupo cuentas por institución
    const byInst = new Map<string, typeof accounts>();
    accounts.forEach(a => {
      if (currency && a.currency !== currency) return; // filtro por moneda si corresponde
      const arr = byInst.get(a.institutionId) ?? [];
      arr.push(a);
      byInst.set(a.institutionId, arr);
    });

    // orden por nombre de institución para UX consistente
    const instsSorted = institutions
      .filter(i => byInst.has(i.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return instsSorted.map(inst => {
      const opts = (byInst.get(inst.id) ?? [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(a => (
          <option key={a.id} value={a.id}>
            {a.name} [{a.currency}] — {money(a.balance)}
          </option>
        ));

      return (
        <optgroup key={inst.id} label={instLabelMap.get(inst.id) ?? inst.name}>
          {opts}
        </optgroup>
      );
    });
  };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Spending (Gastos)</h2>
          <div className="text-sm opacity-70">Mes</div>
        </div>
        <div className="mt-2">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
          />
          <button
            onClick={onGenerate}
            className="ml-2 rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
          >
            Generar mes
          </button>
          {err && <div className="text-sm mt-2 text-amber-600">{err}</div>}
        </div>
      </div>

      {/* Plantillas */}
      <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Plantillas mensuales</h3>
          <button
            type="button"
            onClick={() => setTemplatesOpen(o => !o)}
            aria-expanded={templatesOpen}
            aria-controls="templates-section"
            className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
          >
            {templatesOpen ? "Colapsar" : "Expandir"}
          </button>
        </div>

        <div id="templates-section" hidden={!templatesOpen}>
          <form onSubmit={onAddBill} className="grid gap-2 md:grid-cols-5 mb-3">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nombre (Alquiler, Expensas...)"
              className="md:col-span-2 rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
            />
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as Currency)}
              className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
            >
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={amountType}
              onChange={e => setAmountType(e.target.value as AmountType)}
              className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
            >
              {amountTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              type="number" step="0.01" placeholder="Monto (opcional)"
              className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
            />
            <input
              value={dayOfMonth}
              onChange={e => setDayOfMonth(Number(e.target.value))}
              type="number" min={1} max={28} placeholder="Día"
              className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
            />
            <select
              value={defaultAccountId}
              onChange={e => setDefaultAccountId(e.target.value)}
              className="md:col-span-2 rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
            >
              <option value="">Cuenta por defecto (opcional)</option>
              {renderAccountOptgroups()}
            </select>
            <button className="md:col-span-5 rounded-md px-3 py-2 border border-slate-300 dark:border-slate-700">
              Agregar plantilla
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left opacity-70">
                <tr>
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Moneda</th>
                  <th className="py-2 pr-4">Monto</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Día</th>
                  <th className="py-2 pl-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(b => (
                  <tr key={b.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-2 pr-4">{b.title}</td>
                    <td className="py-2 pr-4">{b.currency}</td>
                    <td className="py-2 pr-4">{money(b.amount)}</td>
                    <td className="py-2 pr-4">{BILL_KIND_LABELS[b.amountType]}</td>
                    <td className="py-2 pr-4">{b.dayOfMonth}</td>
                    <td className="py-2 pl-4 text-right">
                      <button
                        onClick={() => {
                          const newTitle = prompt("Nuevo nombre:", b.title);
                          if (!newTitle) return;
                          const newAmt = prompt("Nuevo monto (vacío si no cambia):", b.amount?.toString() ?? "");
                          const patch: Partial<RecurringBill> = { title: newTitle.trim() };
                          if (newAmt !== null && newAmt !== "") patch.amount = Number(newAmt);
                          void updateRecurringBill(b.id, patch);
                        }}
                        className="mr-2 text-xs rounded-md px-2 py-1 border border-slate-300 dark:border-slate-700"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar plantilla "${b.title}"?`)) void deleteRecurringBill(b.id);
                        }}
                        className="text-xs rounded-md px-2 py-1 border border-slate-300 dark:border-slate-700"
                      >
                        🗑️ Borrar
                      </button>
                    </td>
                  </tr>
                ))}
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-center opacity-60">Sin plantillas aún</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Planner (mes) */}
      <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Planner mensual</h3>
          <span className="text-xs opacity-70">vencimientos del mes</span>
        </div>

        <div className="overflow-x-auto">
          {/* Definimos anchos coherentes para evitar “bailes” */}
          <table className="min-w-full text-sm">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[22%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-2 pr-4">Gasto</th>
                <th className="py-2 pr-4 whitespace-nowrap">Vence</th>
                <th className="py-2 pr-4 text-right">Plan</th>
                <th className="py-2 pr-4 text-right">Pagado</th>
                <th className="py-2 pr-4 text-right">Restante</th>
                <th className="py-2 pr-4">Cuenta</th>
                <th className="py-2 pr-2 text-right">Monto</th>
                <th className="py-2 pl-2 text-right">Pagar</th>
              </tr>
            </thead>
            <tbody>
              {dues.map(d => {
                const planned = d.amountPlanned || 0;
                const paid = d.amountPaid || 0;
                const remaining = Math.max(0, planned - paid);

                return (
                  <tr key={d.id} className="border-t border-slate-200 dark:border-slate-800 align-middle">
                    {/* Gasto */}
                    <td className="py-2 pr-4">
                      <div className="truncate">{d.title}</div>
                      <div className="text-xs opacity-60">[{d.currency}]</div>
                    </td>

                    {/* Vence */}
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDueDate(d.dueDate)}</td>

                    {/* Plan (solo lectura en Fase 1/esta página) */}
                    <td className="py-2 pr-4 text-right tabular-nums">{money(planned)}</td>

                    {/* Pagado */}
                    <td className="py-2 pr-4 text-right tabular-nums">{money(paid)}</td>

                    {/* Restante */}
                    <td className="py-2 pr-4 text-right">
                      <span className="inline-block rounded px-2 py-0.5 border tabular-nums">
                        {money(remaining)}
                      </span>
                    </td>

                    {/* Cuenta (select compacto) */}
                    <td className="py-2 pr-4">
                      <select
                        name={`acc-${d.id}`}
                        defaultValue={d.accountId ?? ""}
                        className="w-full max-w-[320px] min-w-[220px] rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
                      >
                        <option value="">Cuenta…</option>
                        {renderAccountOptgroups(d.currency)}
                      </select>
                    </td>

                    {/* Monto (input angosto, alineado a la derecha) */}
                    <td className="py-2 pr-2">
                      <input
                        name={`amt-${d.id}`}
                        type="number"
                        step="0.01"
                        placeholder="Monto"
                        className="w-24 text-right tabular-nums rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
                      />
                    </td>

                    {/* Botón pagar (siempre alineado a la derecha) */}
                    <td className="py-2 pl-2">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = e.currentTarget as HTMLFormElement;
                          const accEl = document.getElementsByName(`acc-${d.id}`)[0] as HTMLSelectElement;
                          const amtEl = document.getElementsByName(`amt-${d.id}`)[0] as HTMLInputElement;
                          const accountId = accEl?.value ?? "";
                          const amount = amtEl?.value ?? "";
                          void onPay(d.id, accountId, amount);
                          f.reset();
                        }}
                        className="flex justify-end items-center"
                      >
                        <button
                          className="rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700 text-sm"
                          title="Registrar pago"
                        >
                          Pagar
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {dues.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-3 text-center opacity-60">Sin vencimientos para el mes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SpendingPage;
