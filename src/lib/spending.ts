// src/lib/spending.ts (sólo este archivo)

"use client";

import {db} from "./firebase";
import {
  addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy,
  query, runTransaction, where, updateDoc, deleteDoc, Timestamp,
} from "firebase/firestore";
import {dateConverter} from "./converters";
import type {Account, BillDue, BillStatus, Payment, RecurringBill, TxExpense} from "./types";

// === Colecciones con converter ===
// Lectura (incluye id)
const billsColR = () => collection(db, "recurring_bills").withConverter(dateConverter<RecurringBill>());
const duesColR = () => collection(db, "bill_dues").withConverter(dateConverter<BillDue>());
// Escritura (sin id)
type NewRecurringBill = Omit<RecurringBill, "id" | "createdAt"> & { createdAt?: Timestamp };
type NewBillDue = Omit<BillDue, "id" | "createdAt"> & { createdAt?: Timestamp };
type NewTxExpense = Omit<TxExpense, "id" | "createdAt"> & { createdAt?: Timestamp };

const billsColW = () => collection(db, "recurring_bills").withConverter(dateConverter<NewRecurringBill>());

const duesColW = () => collection(db, "bill_dues").withConverter(dateConverter<NewBillDue>());

const txColW = () => collection(db, "transactions").withConverter(dateConverter<NewTxExpense>());

export const createRecurringBill = (userId: string, bill: Omit<RecurringBill, "id" | "userId" | "createdAt">) =>
  addDoc(billsColW(), { userId, ...bill, createdAt: Timestamp.now() });

export const updateRecurringBill = (id: string, patch: Partial<RecurringBill>) =>
  updateDoc(doc(db, "recurring_bills", id), dateConverter<Partial<RecurringBill>>().toFirestore(patch));

export const onBills = (userId: string, set: (rows: RecurringBill[]) => void, onErr: (m: string) => void) => {
  const q = query(billsColR(), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(q, s => set(s.docs.map(d => d.data())), e => onErr(e.message));
};

export const deleteRecurringBill = (id: string) =>
  deleteDoc(doc(db, "recurring_bills", id));

export const onDuesForMonth = (userId: string, month: string, set: (rows: BillDue[]) => void, onErr: (m: string) => void) => {
  const [y, m] = month.split("-").map(Number);
  const start = Timestamp.fromDate(new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)));
  const end = Timestamp.fromDate(new Date(Date.UTC(y, m, 1, 0, 0, 0)));
  const q = query(duesColR(), where("userId", "==", userId), where("dueDate", ">=", start), where("dueDate", "<", end), orderBy("dueDate", "asc"), limit(500));
  return onSnapshot(q, s => set(s.docs.map(d => d.data())), e => onErr(e.message));
};

// === Helper: monthKey (YYYY-MM) + dayOfMonth -> Timestamp UTC del día ===
export const monthKeyToDueTimestamp = (monthKey: string, dayOfMonth: number): Timestamp => {
  const [yStr, mStr] = monthKey.split("-");
  const year = Number(yStr);
  const month = Number(mStr); // 1..12
  const day = Math.max(1, Math.min(28, Number(dayOfMonth) || 1));
  const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return Timestamp.fromDate(d);
};

// === FASE 1: generar bill_dues desde plantillas ===
export const generateMonthDues = async (uid: string, monthKey: string): Promise<number> => {
  if (!uid) return 0;

  const billsSnap = await getDocs(
    query(
      billsColR(),
      where("userId", "==", uid),
      where("active", "==", true)
    )
  );

  let created = 0;

  for (const billDoc of billsSnap.docs) {
    const bill = billDoc.data() as RecurringBill;

    const dueDateTs: Timestamp = monthKeyToDueTimestamp(monthKey, bill.dayOfMonth);

    // Evitar duplicado: mismo userId + billId + dueDate
    const existingSnap = await getDocs(
      query(
        duesColR(),
        where("userId", "==", uid),
        where("billId", "==", bill.id),
        where("dueDate", "==", dueDateTs),
        limit(1)
      )
    );
    if (!existingSnap.empty) continue;

    const dueToCreate: Omit<BillDue, "id"> = {
      userId: uid,
      billId: bill.id,
      title: bill.title,
      currency: bill.currency,
      amountPlanned: 0,               // Fase 1: sin monto (se edita luego)
      amountPaid: 0,
      status: "pending",
      dueDate: dueDateTs,
      ...(bill.defaultAccountId ? { planAccountId: bill.defaultAccountId } : {}),
    };

    await addDoc(duesColW(), dueToCreate);
    created += 1;
  }

  return created;
};

// Registrar pago inmediato (flujo simple que ya tenías)
export const payDue = async (userId: string, dueId: string, accountId: string, amount: number): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const dueRef = doc(db, "bill_dues", dueId).withConverter(dateConverter<BillDue>());
    const accRef = doc(db, "accounts", accountId).withConverter(dateConverter<Account>());

    const dueSnap = await tx.get(dueRef);
    const accSnap = await tx.get(accRef);

    if (!dueSnap.exists() || !accSnap.exists()) throw new Error("Recurso no encontrado");
    const due = dueSnap.data();
    const acc = accSnap.data();

    if (due.userId !== userId || acc.userId !== userId) throw new Error("Acceso denegado");
    if (acc.currency !== due.currency) throw new Error("Moneda distinta. Usa FX primero.");
    if (amount <= 0) throw new Error("Monto inválido");
    if (acc.balance < amount) throw new Error("Saldo insuficiente");

    // Debitar cuenta
    tx.update(accRef, {balance: acc.balance - amount});

    // Transacción de gasto
    const t: NewTxExpense = {
      userId,
      type: "expense",
      accountId,
      amount,
      currency: acc.currency,
      title: due.title,
      createdAt: Timestamp.now(),
    };
    tx.set(doc(txColW()), dateConverter<NewTxExpense>().toFirestore(t));

    // Actualizar due
    const paid = due.amountPaid + amount;
    const status: BillDue["status"] =
      paid >= due.amountPlanned && due.amountPlanned > 0 ? "paid"
        : paid > 0 ? "partial"
          : "pending";

    tx.update(dueRef, {amountPaid: paid, status, accountId});
  });
};

// ========= Helpers de estado y “vencimientos próximos” (3 días) =========

// Soporte robusto para dueDate: Timestamp | Date | string ISO
type DueDateLike = Timestamp | Date | string;

export const dueDateToMillis = (v: DueDateLike): number => {
  if (v instanceof Timestamp) return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const ms = Date.parse(v);
    if (!Number.isNaN(ms)) return ms;
  }
  return NaN; // valor seguro si llega algo inesperado
};

export const computeBillDueStatus = (
  due: Pick<BillDue, "amountPlanned" | "amountPaid" | "dueDate">
): BillStatus => {
  const planned = due.amountPlanned;
  const paid = due.amountPaid;

  if (planned > 0 && paid >= planned) return "paid";

  const nowMs = Date.now();
  const dueMs = dueDateToMillis(due.dueDate as unknown as DueDateLike);

  if (!Number.isFinite(dueMs)) return planned > 0 && paid > 0 ? "partial" : "pending";
  if (dueMs < nowMs) return "overdue";
  if (planned > 0 && paid > 0 && paid < planned) return "partial";
  return "pending";
};

export const isDueSoon = (due: Pick<BillDue, "dueDate">, days = 3): boolean => {
  console.log(due);
  const nowMs = Date.now();
  const edgeMs = nowMs + days * 24 * 60 * 60 * 1000;
  const dueMs = dueDateToMillis(due.dueDate as unknown as DueDateLike);

  if (!Number.isFinite(dueMs)) return false;
  return dueMs >= nowMs && dueMs <= edgeMs;
};

// ==============================
// === EDICIÓN DEL PLAN (Fase 2)
// ==============================

// 1) Monto planificado del mes
export const setDuePlannedAmount = async (uid: string, dueId: string, amountPlanned: number): Promise<void> => {
  if (!uid) throw new Error("uid requerido");
  if (!dueId) throw new Error("dueId requerido");
  if (!Number.isFinite(amountPlanned) || amountPlanned < 0) throw new Error("amountPlanned inválido");

  const ref = doc(db, "bill_dues", dueId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Instancia no encontrada");

    const curr = snap.data() as BillDue;
    if (curr.userId !== uid) throw new Error("No autorizado");

    const nextStatus = computeBillDueStatus({
      amountPlanned,
      amountPaid: curr.amountPaid,
      dueDate: curr.dueDate,
    });

    tx.update(ref, { amountPlanned, status: nextStatus });
  });
};

// 2) Cuenta por defecto del plan (para ese ítem)
export const setDuePlanAccount = async (uid: string, dueId: string, planAccountId: string | undefined): Promise<void> => {
  if (!uid) throw new Error("uid requerido");
  if (!dueId) throw new Error("dueId requerido");

  const ref = doc(db, "bill_dues", dueId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Instancia no encontrada");

    const curr = snap.data() as BillDue;
    if (curr.userId !== uid) throw new Error("No autorizado");

    if (typeof planAccountId === "string" && planAccountId.length > 0) {
      tx.update(ref, {planAccountId});
    } else {
      // No enviar campo si lo querés limpiar (cumple las reglas que exigen string si existe)
    }
  });
};

// 3) Registrar pago parcial/total con actualización de estado
type BillDueUpdatable = {
  amountPaid: number;
  accountId: string;
  status: BillStatus;
  planNote?: string;
};

export const addDuePayment = async (params: {
  uid: string;
  dueId: string;
  amount: number;
  accountId: string;
  note?: string;
}): Promise<void> => {
  const {uid, dueId, amount, accountId, note} = params;

  if (!uid) throw new Error("uid requerido");
  if (!dueId) throw new Error("dueId requerido");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount inválido");
  if (!accountId) throw new Error("accountId requerido");

  const ref = doc(db, "bill_dues", dueId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Instancia no encontrada");

    const curr = snap.data() as BillDue;
    if (curr.userId !== uid) throw new Error("No autorizado");

    const planned = curr.amountPlanned;
    const prevPaid = curr.amountPaid;

    const nextPaidRaw = prevPaid + amount;
    const nextPaid = planned > 0 ? Math.min(nextPaidRaw, planned) : nextPaidRaw;

    const nextStatus = computeBillDueStatus({
      amountPlanned: planned,
      amountPaid: nextPaid,
      dueDate: curr.dueDate,
    });

    const updateData: BillDueUpdatable = { amountPaid: nextPaid, accountId, status: nextStatus };
    if (typeof note === "string") updateData.planNote = note;

    tx.update(ref, updateData);
  });
};

// ==========================
// === Subcolección Pagos ===
// ==========================

// /bill_dues/{dueId}/payments
const paymentsColR = (dueId: string) =>
  collection(db, "bill_dues", dueId, "payments").withConverter(dateConverter<Payment>());

export const onPaymentsForDue = (
  uid: string,
  dueId: string,
  onData: (payments: Payment[]) => void,
  onError: (msg: string) => void
): (() => void) => {
  try {
    const q = query(paymentsColR(dueId), orderBy("date", "asc"));
    return onSnapshot(q, snap => {
      const arr: Payment[] = [];
      snap.forEach(d => {
        const p = d.data();
        if (p.userId === uid) arr.push(p);
      });
      onData(arr);
    }, e => onError(e.message));
  } catch (e: unknown) {
    onError(e instanceof Error ? e.message : String(e));
    return () => {};
  }
};

// Crear registro de pago + actualizar el due en la misma transacción
export const createDuePayment = async (params: {
  uid: string;
  dueId: string;
  amount: number;
  accountId: string;
  date?: Timestamp;
  note?: string;
}): Promise<void> => {
  const { uid, dueId, amount, accountId, date, note } = params;

  if (!uid) throw new Error("uid requerido");
  if (!dueId) throw new Error("dueId requerido");
  if (!accountId) throw new Error("accountId requerido");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount inválido");

  const dueRef = doc(duesColR(), dueId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(dueRef);
    if (!snap.exists()) throw new Error("bill_due no encontrado");

    const curr = snap.data() as BillDue;
    if (curr.userId !== uid) throw new Error("No autorizado");

    const planned = curr.amountPlanned;
    const prevPaid = curr.amountPaid;

    const nextPaidRaw = prevPaid + amount;
    const nextPaid = planned > 0 ? Math.min(nextPaidRaw, planned) : nextPaidRaw;

    // status
    const nowMs = Date.now();
    const dueMs = curr.dueDate.toMillis();
    let nextStatus: BillStatus;
    if (planned > 0 && nextPaid >= planned)      nextStatus = "paid";
    else if (dueMs < nowMs)                      nextStatus = "overdue";
    else if (planned > 0 && nextPaid > 0)        nextStatus = "partial";
    else                                         nextStatus = "pending";

    // 1) Historial de pagos (subcolección)
    const payRef = doc(paymentsColR(dueId));
    const payment: Omit<Payment, "id"> = {
      userId: uid,
      dueId,
      amount,
      accountId,
      date: date ?? Timestamp.now(),
      note,
      createdAt: Timestamp.now(),
    };
    tx.set(payRef, { ...payment, id: payRef.id });

    // 2) Actualizar acumulado
    tx.update(dueRef, { amountPaid: nextPaid, accountId, status: nextStatus });
  });
};
