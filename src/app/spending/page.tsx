// src/app/spending/page.tsx
"use client";

import {JSX, useEffect, useMemo, useState} from "react";
import {useAuth} from "@/lib/auth-context";
import {useUserCollections} from "@/lib/useCollections";
import {
  BILL_KIND_LABELS,
  BillDue,
  KIND_LABELS,
  money,
  RecurringBill,
  fmtDMYfromTs
} from "@/lib/types";
import {
  createRecurringBill,
  deleteRecurringBill,
  generateMonthDues,
  onBills,
  onDuesForMonth,
  payDue,
  updateRecurringBill,
  createOneOffDue,
  deleteDue
} from "@/lib/spending";
import {AmountType, Currency} from "@/lib/converters";
import {Timestamp} from "firebase/firestore";
import {ToastProvider, useToast} from "@/components/ui/ToastProvider";
import {PendingProvider, usePending} from "@/components/ui/PendingProvider";
import TemplateModal from "./_modals/TemplateModal";
import OneOffDueModal from "./_modals/OneOffDueModal";
import ConfirmDeleteModal from "./_modals/ConfirmDeleteModal";

/* ==========
 * Fechas
 * ========== */
const formatDueDate = (v: { toDate?: () => Date } | Date | null | undefined): string => {
  if (!v) return "";
  return fmtDMYfromTs(v);
};

const dateInputToTimestamp = (value: string): Timestamp => {
  const [y, m, d] = value.split("-").map(Number);
  return Timestamp.fromDate(new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0)));
};
const monthKey = (d: Date): string => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/* ==========
 * Estilos acciones
 * ========== */
const ACTIONS_COL_W = "w-[72px]";
const ACTIONS_CELL = `py-2 pl-4 ${ACTIONS_COL_W}`;
const ACTIONS_HEAD = `py-2 pl-4 text-center ${ACTIONS_COL_W}`;
const ICON_GROUP = "inline-flex items-center justify-center rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden";
const ICON_BTN = "px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800";

function Content(): JSX.Element {
  const {user} = useAuth();
  const uid = user?.uid ?? "";
  const {accounts, institutions} = useUserCollections(uid);
  const toast = useToast();
  const {pending, run} = usePending();

  // data
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [dues, setDues] = useState<BillDue[]>([]);
  const [month, setMonth] = useState<string>(monthKey(new Date()));

  // ui
  const [templatesOpen, setTemplatesOpen] = useState<boolean>(false);

  // modales
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [tplToEdit, setTplToEdit] = useState<RecurringBill | null>(null);
  const [oneOffModalOpen, setOneOffModalOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{
    id: string,
    label: string,
    type: "tpl" | "due"
  } | null>(null);

  // subs (streaming de datos)
  useEffect(() => {
    if (!uid) return;
    const unsubBills = onBills(uid, setBills, e => {
      console.error(e);
      toast.error(String(e));
    });
    const unsubDues = onDuesForMonth(uid, month, setDues, e => {
      console.error(e);
      toast.error(String(e));
    });
    return () => {
      unsubBills();
      unsubDues();
    };
  }, [uid, month, toast]);

  const onGenerate = async (): Promise<void> => {
    await run(async () => {
      try {
        if (!uid) return;
        const created = await generateMonthDues(uid, month);
        toast.info(created > 0 ? `Generados ${created} vencimientos.` : "No había nada para generar.");
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const onPay = async (dueId: string, accountId: string, amountStr: string): Promise<void> => {
    await run(async () => {
      try {
        if (!accountId) {
          toast.error("Selecciona una cuenta para pagar.");
          return;
        }
        const amountNum = Number(amountStr);
        if (!(amountNum > 0)) {
          toast.error("Ingresa un monto válido.");
          return;
        }
        await payDue(uid, dueId, accountId, amountNum);
        toast.success("Pago registrado.");
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const onAddTemplate = async (data: {
    title: string;
    currency: Currency;
    amountType: AmountType;
    amount?: number;
    dayOfMonth: number;
    defaultAccountId?: string;
  }) => {
    // cerrar modal de inmediato y ejecutar bloqueado
    setTplModalOpen(false);
    await run(async () => {
      try {
        if (!uid || !data.title.trim()) return;
        await createRecurringBill(uid, {...data, active: true});
        toast.success("Plantilla creada.");
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const onEditTemplate = async (id: string, patch: Partial<RecurringBill>) => {
    setTplToEdit(null);
    await run(async () => {
      try {
        await updateRecurringBill(id, patch);
        toast.success("Plantilla actualizada.");
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const onAddOneOff = async (data: {
    title: string;
    currency: Currency;
    dateISO: string;
    amountPlanned?: number;
    planAccountId?: string;
  }) => {
    setOneOffModalOpen(false);
    await run(async () => {
      try {
        if (!uid || !data.title.trim() || !data.dateISO) return;
        await createOneOffDue({
          uid,
          title: data.title.trim(),
          currency: data.currency,
          dueDate: dateInputToTimestamp(data.dateISO),
          amountPlanned: (Number.isFinite(data.amountPlanned) && (data.amountPlanned ?? 0) >= 0)
            ? (data.amountPlanned ?? 0) : 0,
          planAccountId: data.planAccountId,
        });
        toast.success("Gasto puntual agregado.");
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const onDelete = async (id: string, type: "tpl" | "due") => {
    setConfirmDel(null);
    await run(async () => {
      try {
        if (type === "tpl") {
          await deleteRecurringBill(id);
          toast.success("Plantilla eliminada.");
        } else {
          await deleteDue(id);
          toast.success("Ítem eliminado del plan.");
        }
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  // labels + optgroups
  const instLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    institutions.forEach(i => {
      const kind = KIND_LABELS[i.kind] ?? i.kind;
      m.set(i.id, `${i.name} — ${kind}`);
    });
    return m;
  }, [institutions]);

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
      return <optgroup key={inst.id}
                       label={instLabelMap.get(inst.id) ?? inst.name}>{opts}</optgroup>;
    });
  };

  const renderCols = (classes: string[]) => classes.map((cls, i) => <col key={i} className={cls}/>);

  return (
    <>
      {/* Header */}
      <div
        className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Spending (Gastos)</h2>
            <p className="text-xs opacity-70 mt-0.5">Organiza plantillas y vencimientos del mes</p>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col">
              <label htmlFor="monthInput" className="text-xs opacity-70 mb-1">Mes</label>
              <input
                id="monthInput" type="month" value={month} disabled={pending}
                onChange={e => setMonth(e.target.value)}
                className="rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
              />
            </div>
            <button
              onClick={onGenerate} disabled={pending}
              className="rounded-md px-3 py-2 border border-slate-300 dark:border-slate-700"
              title="Generar vencimientos del mes" aria-label="Generar vencimientos del mes"
            >
              Generar mes
            </button>
          </div>
        </div>
      </div>

      {/* Plantillas */}
      <div
        className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Plantillas mensuales</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTplModalOpen(true)} disabled={pending}
              className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
              title="Nueva plantilla" aria-label="Nueva plantilla"
            >Nueva
            </button>
            <button
              onClick={() => setTemplatesOpen(o => !o)} disabled={pending}
              aria-expanded={templatesOpen} aria-controls="templates-section"
              className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
              title={templatesOpen ? "Colapsar" : "Expandir"}
              aria-label={templatesOpen ? "Colapsar" : "Expandir"}
            >
              {templatesOpen ? "Colapsar" : "Expandir"}
            </button>
          </div>
        </div>

        <div id="templates-section" hidden={!templatesOpen}>
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
                        onClick={() => setTplToEdit(b)} disabled={pending}
                        className={ICON_BTN} title="Editar plantilla" aria-label="Editar plantilla"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"
                             viewBox="0 0 24 24" fill="currentColor">
                          <path
                            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => setConfirmDel({id: b.id, label: b.title, type: "tpl"})}
                        disabled={pending}
                        className={ICON_BTN} title="Borrar plantilla" aria-label="Borrar plantilla"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"
                             viewBox="0 0 24 24" fill="currentColor">
                          <path
                            d="M9 3v1H4v2h16V4h-5V3H9zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/>
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

      {/* Planner mensual */}
      <div
        className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">Planner mensual</h3>
            <span className="text-xs opacity-70">vencimientos del mes</span>
          </div>
        </div>

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
                <tr key={d.id}
                    className="border-t border-slate-200 dark:border-slate-800 align-middle">
                  <td className="py-2 pr-4">
                    <div className="truncate">{d.title}</div>
                    <div className="text-xs opacity-60">[{d.currency}]</div>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDueDate(d.dueDate)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{money(planned)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{money(paid)}</td>
                  <td className="py-2 pr-4 text-right">
                    <span
                      className="inline-block rounded px-2 py-0.5 border tabular-nums">{money(remaining)}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      defaultValue={d.accountId ?? ""} disabled={pending}
                      className="w-full max-w-[320px] min-w-[220px] rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
                    >
                      <option value="">Cuenta…</option>
                      {renderAccountOptgroups(d.currency)}
                    </select>
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <input
                      id={amountInputId} type="number" step="0.01" min={0} placeholder="0,00"
                      disabled={pending}
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
                        className={ICON_BTN} title="Registrar pago" aria-label="Registrar pago"
                        disabled={pending}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"
                             viewBox="0 0 24 24" fill="currentColor">
                          <path
                            d="M3 5h18a2 2 0 0 1 2 2v2H1V7a2 2 0 0 1 2-2zm-2 6h22v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-6zm4 4h6v2H5v-2z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => setConfirmDel({id: d.id, label: d.title, type: "due"})}
                        className={ICON_BTN} title="Borrar ítem del plan"
                        aria-label="Borrar ítem del plan" disabled={pending}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"
                             viewBox="0 0 24 24" fill="currentColor">
                          <path
                            d="M9 3v1H4v2h16V4h-5V3H9zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {dues.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 text-center opacity-60">Sin vencimientos para el
                  mes
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      <TemplateModal
        open={tplModalOpen}
        onClose={() => setTplModalOpen(false)}
        onSubmit={onAddTemplate}
        renderAccountOptgroups={renderAccountOptgroups}
      />
      <TemplateModal
        open={!!tplToEdit}
        onClose={() => setTplToEdit(null)}
        onSubmit={async (data) => {
          if (tplToEdit) await onEditTemplate(tplToEdit.id!, data as Partial<RecurringBill>);
        }}
        renderAccountOptgroups={renderAccountOptgroups}
        initial={tplToEdit ?? undefined}
        submitLabel="Actualizar"
      />
      <OneOffDueModal
        open={oneOffModalOpen}
        onClose={() => setOneOffModalOpen(false)}
        onSubmit={onAddOneOff}
        renderAccountOptgroups={renderAccountOptgroups}
      />
      <ConfirmDeleteModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={`Confirmar eliminación`}
        message={confirmDel ? `¿Eliminar "${confirmDel.label}"?` : undefined}
        onConfirm={async () => {
          if (confirmDel) await onDelete(confirmDel.id, confirmDel.type);
        }}
      />
    </>
  );
}

export default function SpendingPage(): JSX.Element {
  return (
    <ToastProvider>
      <PendingProvider>
        <div className="grid gap-6">
          <Content/>
        </div>
      </PendingProvider>
    </ToastProvider>
  );
}
