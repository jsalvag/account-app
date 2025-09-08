// src/app/spending/page.tsx
"use client";

import {JSX, useEffect, useMemo, useState} from "react";
import {useAuth} from "@/lib/auth-context";
import {useUserCollections} from "@/lib/useCollections";
import {
  BILL_KIND_LABELS,
  money,
  fmtDMYfromTs,
  HasToDate,
  type BillDue,
  type RecurringBill,
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
  deleteDue,
} from "@/lib/spending";
import { AMOUNT_TYPE, AmountType, Currency } from "@/lib/converters";
import {Timestamp} from "firebase/firestore";
import {ToastProvider, useToast} from "@/components/ui/ToastProvider";
import {PendingProvider, usePending} from "@/components/ui/PendingProvider";
import TemplateModal from "./_modals/TemplateModal";
import OneOffDueModal from "./_modals/OneOffDueModal";
import ConfirmDeleteModal from "./_modals/ConfirmDeleteModal";

/* ==========
 * Fechas
 * ========== */
const formatDueDate = (v: HasToDate | Date | null | undefined): string => {
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
const ACTIONS_COL_W = "w-[84px]";
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
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [tplToEdit, setTplToEdit] = useState<RecurringBill | null>(null);
  const [oneOffModalOpen, setOneOffModalOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{
    id: string;
    label: string;
    type: "tpl" | "due";
  } | null>(null);

  // maps
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const instNameById = useMemo(
    () => new Map(institutions.map((i) => [i.id, i.name])),
    [institutions]
  );
  const labelAcc = (id?: string): string => {
    if (!id) return "";
    const a = accById.get(id);
    if (!a) return id;
    const inst = instNameById.get(a.institutionId);
    const instPart = inst ? `${inst} › ` : "";
    return `${instPart}${a.name} [${a.currency}]`;
  };

  /* ==========
   * Suscripciones
   * ========== */
  useEffect(() => {
    if (!uid) return;
    const unsubBills = onBills(
      uid,
      (rows) => setBills(rows),
      (e) => {
      console.error(e);
      toast.error("Error cargando plantillas");
      }
    );
    const unsubDues = onDuesForMonth(
      uid,
      month,
      (rows) => setDues(rows),
      (e) => {
      console.error(e);
      toast.error("Error cargando vencimientos");
    });
    return () => {
      unsubBills();
      unsubDues();
    };
  }, [uid, month, toast]);

  /* ==========
   * Handlers — Plantillas
   * ========== */
  const openCreateTpl = (): void => {
    setTplToEdit(null);
    setTplModalOpen(true);
  };
  const openEditTpl = (tpl: RecurringBill): void => {
    setTplToEdit(tpl);
    setTplModalOpen(true);
  };
  const onSubmitTpl = async (data: {
    title: string;
    currency: Currency;
    amountType: AmountType;
    amount?: number;
    dayOfMonth: number;
    active: boolean;
    defaultAccountId?: string;
  }): Promise<void> => {
    await run(async () => {
      try {
        if (!uid) throw new Error("Usuario no autenticado");
        if (tplToEdit) {
          await updateRecurringBill(tplToEdit.id, {
            title: data.title.trim(),
            currency: data.currency,
            amountType: data.amountType,
            amount:
              data.amountType === AMOUNT_TYPE.fixed || data.amountType === AMOUNT_TYPE.estimate
                ? Number(data.amount ?? 0)
                : undefined,
            dayOfMonth: Math.max(1, Math.min(28, Number(data.dayOfMonth || 1))),
            active: Boolean(data.active),
            defaultAccountId: data.defaultAccountId || undefined,
          });
          toast.success("Plantilla actualizada");
        } else {
          await createRecurringBill(uid, {
            title: data.title.trim(),
            currency: data.currency,
            amountType: data.amountType,
            amount:
              data.amountType === AMOUNT_TYPE.fixed || data.amountType === AMOUNT_TYPE.estimate
                ? Number(data.amount ?? 0)
                : undefined,
            dayOfMonth: Math.max(1, Math.min(28, Number(data.dayOfMonth || 1))),
            active: Boolean(data.active),
            defaultAccountId: data.defaultAccountId || undefined,
          });
          toast.success("Plantilla creada");
        }
    setTplModalOpen(false);
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const onDeleteTplAsk = (tpl: RecurringBill): void => {
    setConfirmDel({ id: tpl.id, label: tpl.title, type: "tpl" });
  };

  const onDeleteTplConfirm = async (): Promise<void> => {
    const item = confirmDel;
    if (!item || item.type !== "tpl") return;
    await run(async () => {
      try {
        await deleteRecurringBill(item.id);
        toast.success("Plantilla eliminada");
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setConfirmDel(null);
      }
    });
  };

  const onGenerateMonth = async (): Promise<void> => {
    await run(async () => {
      try {
        if (!uid) throw new Error("Usuario no autenticado");
        const n = await generateMonthDues(uid, month);
        if (n > 0) toast.success(`Generados ${n} vencimientos`);
        else toast.info("No había vencimientos por generar");
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  /* ==========
   * Handlers — Vencimientos
   * ========== */
  const openCreateOneOff = (): void => setOneOffModalOpen(true);

  const onCreateOneOff = async (data: {
    title: string;
    currency: Currency;
    dueDate: string; // yyyy-mm-dd
    amountPlanned: number;
    planAccountId?: string;
  }): Promise<void> => {
    await run(async () => {
      try {
        if (!uid) throw new Error("Usuario no autenticado");
        const dueDateTs = dateInputToTimestamp(data.dueDate);
        await createOneOffDue({
          uid,
          title: data.title.trim(),
          currency: data.currency,
          dueDate: dueDateTs,
          amountPlanned: Number(data.amountPlanned || 0),
          planAccountId: data.planAccountId || undefined,
        });
        toast.success("Vencimiento creado");
        setOneOffModalOpen(false);
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const onDeleteDueAsk = (due: BillDue): void => {
    setConfirmDel({
      id: due.id,
      label: `${due.title} · ${formatDueDate(due.dueDate)}`,
      type: "due",
    });
  };

  const onDeleteDueConfirm = async (): Promise<void> => {
    const item = confirmDel;
    if (!item || item.type !== "due") return;
    await run(async () => {
      try {
        await deleteDue(item.id);
        toast.success("Vencimiento eliminado");
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
    setConfirmDel(null);
      }
    });
  };

  const onPay = async (due: BillDue, form: HTMLFormElement): Promise<void> => {
    await run(async () => {
      try {
        if (!uid) throw new Error("Usuario no autenticado");
        const fd = new FormData(form);
        const accountId = String(fd.get("accountId") || "");
        const amountStr = String(fd.get("amount") || "");
        const amountNum = Number(amountStr);
        if (!accountId) {
          toast.error("Selecciona una cuenta");
          return;
        }
        if (!(amountNum > 0)) {
          toast.error("Ingresa un monto válido");
          return;
        }
        await payDue(uid, due.id, accountId, amountNum);
        toast.success("Pago registrado");
        form.reset();
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  };

  // helpers UI
  const monthInputValue = month;
  const setMonthFromInput = (value: string): void => setMonth(value);

  return (
    <div className="grid gap-6">
      {/* Toolbar y acciones */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm flex items-center gap-2">
            <span>Mes</span>
              <input
              type="month"
              value={monthInputValue}
              onChange={(e) => setMonthFromInput(e.target.value)}
                className="rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
              />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTemplatesOpen((v) => !v)}
              className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
            >
              {templatesOpen ? "Ocultar plantillas" : "Ver plantillas"}
            </button>
            <button
              type="button"
              onClick={openCreateTpl}
              className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
            >
              Nueva plantilla
            </button>
            <button
              type="button"
              onClick={onGenerateMonth}
              disabled={pending}
              className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
            >
              Generar mes
            </button>
            <button
              type="button"
              onClick={openCreateOneOff}
              className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
            >
              Nuevo vencimiento puntual
            </button>
          </div>
        </div>
      </div>

      {/* Plantillas (collapsible) */}
      {templatesOpen && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h3 className="text-lg font-semibold mb-3">Plantillas</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left opacity-70">
              <tr>
                  <th className="py-2 pr-4">Título</th>
                <th className="py-2 pr-4">Moneda</th>
                <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4 text-right">Monto</th>
                <th className="py-2 pr-4">Día</th>
                  <th className="py-2 pr-4">Predeterminada</th>
                <th className={ACTIONS_HEAD}>Acciones</th>
              </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const amount =
                    b.amountType === AMOUNT_TYPE.fixed || b.amountType === AMOUNT_TYPE.estimate
                      ? b.amount ?? 0
                      : undefined;
                  return (
                <tr key={b.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-2 pr-4">{b.title}</td>
                  <td className="py-2 pr-4">{b.currency}</td>
                      <td className="py-2 pr-4">
                        {
                          BILL_KIND_LABELS[
                            b.amountType === AMOUNT_TYPE.fixed
                            ? "fixed"
                              : b.amountType === AMOUNT_TYPE.estimate
                            ? "estimate"
                            : "variable"
                        ]}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {amount !== undefined ? money(amount) : "—"}
                      </td>
                  <td className="py-2 pr-4">{b.dayOfMonth}</td>
                      <td className="py-2 pr-4">{b.defaultAccountId ? labelAcc(b.defaultAccountId) : "—"}</td>
                  <td className={ACTIONS_CELL}>
                        <div className={ICON_GROUP}>
                      <button
                            type="button"
                            className={ICON_BTN}
                            onClick={() => openEditTpl(b)}
                            title="Editar"
                            aria-label="Editar"
                      >
                            ✏️
                      </button>
                      <button
                            type="button"
                            className={ICON_BTN}
                            onClick={() => onDeleteTplAsk(b)}
                            title="Eliminar"
                            aria-label="Eliminar"
                      >
                            🗑️
                      </button>
                    </div>
                  </td>
                </tr>
                  );
                })}
              {bills.length === 0 && (
                <tr>
                    <td colSpan={7} className="py-3 text-center opacity-60">
                      No hay plantillas
                    </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vencimientos del mes */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Vencimientos del mes</h3>
          <div className="text-sm opacity-70">{dues.length} items</div>
          </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left opacity-70">
            <tr>
              <th className="py-2 pr-4">Gasto</th>
              <th className="py-2 pr-4">Vence</th>
                <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4 text-right">Plan</th>
              <th className="py-2 pr-4 text-right">Pagado</th>
                <th className="py-2 pr-4">Cuenta plan</th>
                <th className="py-2 pr-4">Pagar</th>
              <th className={ACTIONS_HEAD}>Acciones</th>
            </tr>
            </thead>
            <tbody>
              {dues.map((d) => {
                const plan = d.amountPlanned || 0;
              const paid = d.amountPaid || 0;
                const rem = Math.max(0, plan - paid);
                const colorStatus =
                  d.status === "paid" ? "text-emerald-600" : d.status === "partial" ? "text-amber-600" : "";

              return (
                  <tr key={d.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-2 pr-4">
                      {d.title} <span className="opacity-60">[{d.currency}]</span>
                  </td>
                    <td className="py-2 pr-4">{formatDueDate(d.dueDate)}</td>
                    <td className={`py-2 pr-4 ${colorStatus}`}>{d.status}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(plan)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{money(paid)}</td>
                    <td className="py-2 pr-4">{d.planAccountId ? labelAcc(d.planAccountId) : "—"}</td>
                  <td className="py-2 pr-4">
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void onPay(d, e.currentTarget);
                        }}
                      >
                    <select
                          name="accountId"
                          defaultValue={d.planAccountId ?? ""}
                          className="rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
                    >
                          <option value="" disabled>
                            Cuenta
                          </option>
                          {accounts
                            .filter((a) => a.currency === d.currency)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {labelAcc(a.id)}
                              </option>
                            ))}
                    </select>
                    <input
                          name="amount"
                          type="number"
                          step="0.00000001"
                          placeholder={rem > 0 ? String(rem) : "0"}
                          className="w-28 rounded-md border px-2 py-1 bg-white dark:bg-slate-800 text-right"
                        />
                        <button
                          type="submit"
                      disabled={pending}
                          className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700"
                        >
                          Pagar
                        </button>
                      </form>
                  </td>
                  <td className={ACTIONS_CELL}>
                      <div className={ICON_GROUP}>
                      <button
                          type="button"
                          className={ICON_BTN}
                          onClick={() => onDeleteDueAsk(d)}
                          title="Eliminar"
                          aria-label="Eliminar"
                      >
                          🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {dues.length === 0 && (
              <tr>
                  <td colSpan={8} className="py-3 text-center opacity-60">
                    No hay vencimientos para este mes
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      {tplModalOpen && (
      <TemplateModal
        open={tplModalOpen}
        onClose={() => setTplModalOpen(false)}
          onSubmit={onSubmitTpl}
        initial={tplToEdit ?? undefined}
          accounts={accounts}
      />
      )}

      {oneOffModalOpen && (
      <OneOffDueModal
        open={oneOffModalOpen}
        onClose={() => setOneOffModalOpen(false)}
          onSubmit={onCreateOneOff}
          accounts={accounts}
      />
      )}

      {confirmDel && (
      <ConfirmDeleteModal
        open={!!confirmDel}
          title="Confirmar eliminación"
          description={confirmDel.label}
          onCancel={() => setConfirmDel(null)}
          onConfirm={confirmDel.type === "tpl" ? onDeleteTplConfirm : onDeleteDueConfirm}
      />
      )}
    </div>
  );
}

export default function Page(): JSX.Element {
  return (
    <ToastProvider>
      <PendingProvider>
          <Content/>
      </PendingProvider>
    </ToastProvider>
  );
}
