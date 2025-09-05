"use client";

import {JSX, useEffect, useMemo, useState} from "react";
import {useAuth} from "@/lib/auth-context";
import {useUserCollections} from "@/lib/useCollections";
import {BILL_KIND_LABELS, BillDue, KIND_LABELS, money, RecurringBill} from "@/lib/types";
import {
  createRecurringBill, deleteRecurringBill,
  generateMonthDues, onBills, onDuesForMonth,
  payDue, updateRecurringBill,
  // nuevos
  createOneOffDue, deleteDue
} from "@/lib/spending";
import {AmountType, amountTypes, currencies, Currency} from "@/lib/converters";
import {Timestamp} from "firebase/firestore";

// --- Helpers de fecha ---
const fmtDMY = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
type TimestampLike = { toDate: () => Date };
const isTimestampLike = (v: unknown): v is TimestampLike =>
  typeof v === "object" && v !== null && "toDate" in v && typeof (v as TimestampLike).toDate === "function";
const formatDueDate = (v: unknown): string => {
  if (!v) return "";
  const d: Date = isTimestampLike(v) ? v.toDate() : (v as Date);
  return fmtDMY(d);
};
// yyyy-mm-dd -> Timestamp (UTC 00:00)
const dateInputToTimestamp = (value: string): Timestamp => {
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
  return Timestamp.fromDate(dt);
};
const monthKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

// Estilos para columna de acciones (ancho fijo + centrado)
const ACTIONS_COL_W = "w-[72px]";
const ACTIONS_CELL = `py-2 pl-4 ${ACTIONS_COL_W}`;
const ACTIONS_HEAD = `py-2 pl-4 text-center ${ACTIONS_COL_W}`;
const ICON_GROUP =
  "inline-flex items-center justify-center rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden";
const ICON_BTN = "px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800";

const SpendingPage = (): JSX.Element => {
  const {user} = useAuth();
  const uid = user?.uid ?? "";
  const {accounts, institutions} = useUserCollections(uid);

  // UI state
  const [err, setErr] = useState<string>("");
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [dues, setDues] = useState<BillDue[]>([]);
  const [month, setMonth] = useState<string>(monthKey(new Date()));

  // Form plantilla
  const [title, setTitle] = useState<string>("");
  const [currency, setCurrency] = useState<string>("ARS");
  const [amountType, setAmountType] = useState<RecurringBill["amountType"]>("fixed");
  const [amount, setAmount] = useState<number | "">("");
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [defaultAccountId, setDefaultAccountId] = useState<string>("");

  // Toggles
  const [templatesOpen, setTemplatesOpen] = useState<boolean>(false);
  const [plannerFormOpen, setPlannerFormOpen] = useState<boolean>(false); // oculto por defecto

  // Form ítem puntual
  const [oneTitle, setOneTitle] = useState<string>("");
  const [oneCurrency, setOneCurrency] = useState<string>("ARS");
  const [oneDate, setOneDate] = useState<string>("");
  const [onePlan, setOnePlan] = useState<string>("");
  const [onePlanAcc, setOnePlanAcc] = useState<string>("");

  // Subscripciones
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
      setTitle(""); setAmount(""); setDayOfMonth(1); setDefaultAccountId("");
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
      if (!accountId) { setErr("Selecciona una cuenta para pagar."); return; }
      const amountNum = Number(amountStr);
      if (!(amountNum > 0)) { setErr("Ingresa un monto válido."); return; }
      await payDue(uid, dueId, accountId, amountNum);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const onAddOneOff = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      if (!uid || !oneTitle.trim() || !oneDate) return;
      const ts = dateInputToTimestamp(oneDate);
      const planned = onePlan === "" ? 0 : Number(onePlan);
      await createOneOffDue({
        uid,
        title: oneTitle.trim(),
        currency: oneCurrency,
        dueDate: ts,
        amountPlanned: Number.isFinite(planned) && planned >= 0 ? planned : 0,
        planAccountId: onePlanAcc || undefined,
      });
      setOneTitle(""); setOnePlan(""); setOnePlanAcc("");
      setPlannerFormOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  // Label de institución
  const instLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    institutions.forEach(i => {
      const kind = KIND_LABELS[i.kind] ?? i.kind;
      m.set(i.id, `${i.name} — ${kind}`);
    });
    return m;
  }, [institutions]);

  // Options agrupadas por institución (opcional filtrar por moneda)
  const renderAccountOptgroups = (filterCurrency?: string): JSX.Element[] => {
    const byInst = new Map<string, typeof accounts>();
    accounts.forEach(a => {
      if (filterCurrency && a.currency !== filterCurrency) return;
      const arr = byInst.get(a.institutionId) ?? [];
      arr.push(a);
      byInst.set(a.institutionId, arr);
    });
    const instsSorted = institutions.filter(i => byInst.has(i.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return instsSorted.map(inst => {
      const opts = (byInst.get(inst.id) ?? [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(a => (
          <option key={a.id} value={a.id}>
            {a.name} [{a.currency}] — {money(a.balance)}
          </option>
        ));
      return <optgroup key={inst.id} label={instLabelMap.get(inst.id) ?? inst.name}>{opts}</optgroup>;
    });
  };

  // Helpers para <colgroup> sin nodos de texto
  const renderCols = (classes: string[]) =>
    classes.map((cls, i) => <col key={i} className={cls} />);

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Spending (Gastos)</h2>
            <p className="text-xs opacity-70 mt-0.5">Organiza plantillas y vencimientos del mes</p>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col">
              <label htmlFor="monthInput" className="text-xs opacity-70 mb-1">Mes</label>
              <input
                id="monthInput"
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
              />
            </div>
            <button
              onClick={onGenerate}
              className="rounded-md px-3 py-2 border border-slate-300 dark:border-slate-700"
              title="Generar vencimientos del mes"
              aria-label="Generar vencimientos del mes"
            >
              Generar mes
            </button>
          </div>
        </div>
        {err && <div className="text-sm mt-3 text-amber-600">{err}</div>}
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
            title={templatesOpen ? "Colapsar" : "Expandir"}
            aria-label={templatesOpen ? "Colapsar" : "Expandir"}
          >
            {templatesOpen ? "Colapsar" : "Expandir"}
          </button>
        </div>

        <div id="templates-section" hidden={!templatesOpen}>
          <form onSubmit={onAddBill} className="grid gap-3 md:grid-cols-6 mb-4">
            <div className="md:col-span-2">
              <label htmlFor="tplTitle" className="text-xs opacity-70 mb-1 block">Nombre</label>
              <input
                id="tplTitle"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Alquiler, Expensas…"
                className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label htmlFor="tplCurrency" className="text-xs opacity-70 mb-1 block">Moneda</label>
              <select
                id="tplCurrency"
                value={currency}
                onChange={e => setCurrency(e.target.value as Currency)}
                className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
              >
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tplType" className="text-xs opacity-70 mb-1 block">Tipo</label>
              <select
                id="tplType"
                value={amountType}
                onChange={e => setAmountType(e.target.value as AmountType)}
                className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
              >
                {amountTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tplAmount" className="text-xs opacity-70 mb-1 block">Monto (opcional)</label>
              <input
                id="tplAmount"
                value={amount}
                onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                type="number" step="0.01" placeholder="0,00"
                className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800 text-right tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="tplDay" className="text-xs opacity-70 mb-1 block">Día</label>
              <input
                id="tplDay"
                value={dayOfMonth}
                onChange={e => setDayOfMonth(Number(e.target.value))}
                type="number" min={1} max={28} placeholder="Día"
                className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="tplAccount" className="text-xs opacity-70 mb-1 block">Cuenta por defecto</label>
              <select
                id="tplAccount"
                value={defaultAccountId}
                onChange={e => setDefaultAccountId(e.target.value)}
                className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
              >
                <option value="">(opcional)</option>
                {renderAccountOptgroups()}
              </select>
            </div>
            <div className="md:col-span-6 flex justify-end">
              <button className="rounded-md px-3 py-2 border border-slate-300 dark:border-slate-700">
                Agregar plantilla
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <colgroup>
                {renderCols(["", "w-[88px]", "w-[120px]", "w-[120px]", "w-[80px]", ACTIONS_COL_W])}
              </colgroup>
              <thead className="text-left opacity-70">
              <tr>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Moneda</th>
                <th className="py-2 pr-4">Monto</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Día</th>
                <th className={ACTIONS_HEAD}>Acciones</th>
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
                  <td className={ACTIONS_CELL}>
                    <div className={`${ICON_GROUP} mx-auto`}>
                      <button
                        onClick={() => {
                          const newTitle = prompt("Nuevo nombre:", b.title);
                          if (!newTitle) return;
                          const newAmt = prompt("Nuevo monto (vacío si no cambia):", b.amount?.toString() ?? "");
                          const patch: Partial<RecurringBill> = {title: newTitle.trim()};
                          if (newAmt !== null && newAmt !== "") (patch as any).amount = Number(newAmt);
                          void updateRecurringBill(b.id, patch);
                        }}
                        className={ICON_BTN}
                        title="Editar plantilla" aria-label="Editar plantilla"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => { if (confirm(`¿Eliminar plantilla "${b.title}"?`)) void deleteRecurringBill(b.id); }}
                        className={ICON_BTN}
                        title="Borrar plantilla" aria-label="Borrar plantilla"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 3v1H4v2h16V4h-5V3H9zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/>
                        </svg>
                      </button>
                    </div>
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
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">Planner mensual</h3>
            <span className="text-xs opacity-70">vencimientos del mes</span>
          </div>
          <button
            type="button"
            onClick={() => setPlannerFormOpen(v => !v)}
            aria-expanded={plannerFormOpen}
            aria-controls="planner-form"
            className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
            title={plannerFormOpen ? "Ocultar formulario" : "Agregar gasto puntual"}
          >
            {plannerFormOpen ? "Ocultar" : "Agregar gasto puntual"}
          </button>
        </div>

        {/* Formulario colapsable */}
        <form
          id="planner-form"
          onSubmit={onAddOneOff}
          hidden={!plannerFormOpen}
          className="grid gap-3 md:grid-cols-6 items-end mb-4"
        >
          <div className="md:col-span-2">
            <label htmlFor="oneTitle" className="text-xs opacity-70 mb-1 block">Concepto</label>
            <input
              id="oneTitle"
              value={oneTitle}
              onChange={e => setOneTitle(e.target.value)}
              placeholder="Gasto puntual…"
              className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
              required
            />
          </div>
          <div>
            <label htmlFor="oneCurrency" className="text-xs opacity-70 mb-1 block">Moneda</label>
            <select
              id="oneCurrency"
              value={oneCurrency}
              onChange={e => setOneCurrency(e.target.value as Currency)}
              className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
            >
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="oneDate" className="text-xs opacity-70 mb-1 block">Fecha</label>
            <input
              id="oneDate"
              type="date"
              value={oneDate}
              onChange={e => setOneDate(e.target.value)}
              className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
              title="dd/mm/yyyy"
              required
            />
          </div>
          <div>
            <label htmlFor="onePlan" className="text-xs opacity-70 mb-1 block">Plan</label>
            <input
              id="onePlan"
              type="number" step="0.01" min={0}
              value={onePlan}
              onChange={e => setOnePlan(e.target.value)}
              placeholder="0,00"
              className="w-full text-right tabular-nums rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="onePlanAcc" className="text-xs opacity-70 mb-1 block">Cuenta sugerida</label>
            <select
              id="onePlanAcc"
              value={onePlanAcc}
              onChange={e => setOnePlanAcc(e.target.value)}
              className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
            >
              <option value="">(opcional)</option>
              {renderAccountOptgroups(oneCurrency)}
            </select>
          </div>
          <div className="md:col-span-6 flex justify-end">
            <div className={ICON_GROUP}>
              <button className="px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-800" title="Agregar ítem puntual" aria-label="Agregar ítem puntual">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z"/>
                </svg>
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <colgroup>
              {renderCols([
                "w-[24%]", "w-[10%]", "w-[12%]", "w-[12%]", "w-[12%]",
                "w-[20%]", "w-[12%]", ACTIONS_COL_W
              ])}
            </colgroup>
            <thead className="text-left opacity-70">
            <tr>
              <th className="py-2 pr-4">Gasto</th>
              <th className="py-2 pr-4">Vence</th>
              <th className="py-2 pr-4 text-right">Plan</th>
              <th className="py-2 pr-4 text-right">Pagado</th>
              <th className="py-2 pr-4 text-right">Restante</th>
              <th className="py-2 pr-4">Cuenta</th>
              <th className="py-2 pr-4 text-right">Monto</th>
              <th className={ACTIONS_HEAD}>Acciones</th>
            </tr>
            </thead>
            <tbody>
            {dues.map(d => {
              const planned = d.amountPlanned || 0;
              const paid = d.amountPaid || 0;
              const remaining = Math.max(0, planned - paid);
              const amountInputId = `amt-${d.id}`;

              return (
                <tr key={d.id} className="border-t border-slate-200 dark:border-slate-800 align-middle">
                  <td className="py-2 pr-4">
                    <div className="truncate">{d.title}</div>
                    <div className="text-xs opacity-60">[{d.currency}]</div>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDueDate(d.dueDate)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{money(planned)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{money(paid)}</td>
                  <td className="py-2 pr-4 text-right">
                    <span className="inline-block rounded px-2 py-0.5 border tabular-nums">{money(remaining)}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      defaultValue={d.accountId ?? ""}
                      className="w-full max-w-[320px] min-w-[220px] rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
                    >
                      <option value="">Cuenta…</option>
                      {renderAccountOptgroups(d.currency)}
                    </select>
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <input
                      id={amountInputId}
                      type="number" step="0.01" min={0}
                      placeholder="0,00"
                      className="w-24 text-right tabular-nums rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
                    />
                  </td>
                  <td className={ACTIONS_CELL}>
                    <div className={`${ICON_GROUP} mx-auto`}>
                      <button
                        onClick={() => {
                          const row = document.getElementById(amountInputId)?.closest("tr");
                          const sel = row?.querySelector("select") as HTMLSelectElement | null;
                          const inp = document.getElementById(amountInputId) as HTMLInputElement | null;
                          const acc = sel?.value ?? d.accountId ?? "";
                          const amt = inp?.value ?? "";
                          void onPay(d.id, acc, amt);
                        }}
                        className={ICON_BTN}
                        title="Registrar pago" aria-label="Registrar pago"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 5h18a2 2 0 0 1 2 2v2H1V7a2 2 0 0 1 2-2zm-2 6h22v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6zm4 4h6v2H5v-2z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => { if (confirm(`¿Eliminar "${d.title}" del plan?`)) void deleteDue(d.id); }}
                        className={ICON_BTN}
                        title="Borrar ítem del plan" aria-label="Borrar ítem del plan"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 3v1H4v2h16V4h-5V3H9zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/>
                        </svg>
                      </button>
                    </div>
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
