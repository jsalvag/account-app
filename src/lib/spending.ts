// src/lib/spending.ts
"use client";

import {
  Timestamp,
  runTransaction,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  type Unsubscribe,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dateConverter } from "@/lib/converters";
import type { Account, BillDue, RecurringBill, Transaction } from "@/lib/types";

/* ===========================================================
 *  Colecciones tipadas (READ vs WRITE)
 *  - READ   => tipo con `id` requerido (para leer/consultar/actualizar/borrar)
 *  - WRITE  => tipo sin `id` (para crear documentos con addDoc/setDoc)
 * =========================================================== */
function accountsColREAD() {
  return collection(db, "accounts").withConverter(dateConverter<Account>());
}

function duesColREAD() {
  return collection(db, "bill_dues").withConverter(dateConverter<BillDue>());
}
function duesColWRITE() {
  return collection(db, "bill_dues").withConverter(dateConverter<Omit<BillDue, "id">>());
}

function recurringColREAD() {
  return collection(db, "recurring_bills").withConverter(dateConverter<RecurringBill>());
}
function recurringColWRITE() {
  return collection(db, "recurring_bills").withConverter(dateConverter<Omit<RecurringBill, "id">>());
}

function transactionsColREAD() {
  return collection(db, "transactions").withConverter(dateConverter<Transaction>());
}
function transactionsColWRITE() {
  return collection(db, "transactions").withConverter(dateConverter<Omit<Transaction, "id">>());
}

/* ===========================================================
 *  onBills: suscripción a plantillas (recurring bills) del usuario
 * =========================================================== */
export function onBills(
  userId: string,
  onNext: (bills: RecurringBill[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const qc: QueryConstraint[] = [
    where("userId", "==", userId),
    orderBy("dayOfMonth", "asc"),
  ];
  return onSnapshot(
    query(recurringColREAD(), ...qc),
    (snap) => {
      const list: RecurringBill[] = [];
      snap.forEach((d) => list.push(d.data()));
      onNext(list);
    },
    (err) => onError?.(err),
  );
}

/* ===========================================================
 *  Crear / actualizar / borrar plantilla
 * =========================================================== */
export async function createRecurringBill(
  userId: string,
  bill: Omit<RecurringBill, "id" | "userId" | "createdAt">,
): Promise<string> {
  const payload: Omit<RecurringBill, "id"> = {
    ...bill,
    userId,
    createdAt: Timestamp.now(),
  };
  const ref = await addDoc(recurringColWRITE(), payload);
  return ref.id;
}

export async function updateRecurringBill(
  billId: string,
  patch: Partial<Omit<RecurringBill, "id" | "userId" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(recurringColREAD(), billId), patch);
}

export async function deleteRecurringBill(billId: string): Promise<void> {
  await deleteDoc(doc(recurringColREAD(), billId));
}

/* ===========================================================
 *  onDuesForMonth: suscribe los vencimientos de un mes (YYYY-MM)
 * =========================================================== */
export function onDuesForMonth(
  userId: string,
  month: string, // "YYYY-MM"
  onNext: (dues: BillDue[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));

  const qc: QueryConstraint[] = [
    where("userId", "==", userId),
    where("dueDate", ">=", Timestamp.fromDate(start)),
    where("dueDate", "<", Timestamp.fromDate(end)),
    orderBy("dueDate", "asc"),
  ];

  return onSnapshot(
    query(duesColREAD(), ...qc),
    (snap) => {
      const list: BillDue[] = [];
      snap.forEach((d) => list.push(d.data()));
      onNext(list);
    },
    (err) => onError?.(err),
  );
}

/* ===========================================================
 *  generateMonthDues: crea vencimientos del mes desde plantillas
 *  (sin duplicar por bill/mes)
 * =========================================================== */
export async function generateMonthDues(
  userId: string,
  month: string, // "YYYY-MM"
): Promise<number> {
  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 1));

  // plantillas activas
  const billsSnap = await getDocs(
    query(recurringColREAD(), where("userId", "==", userId), where("active", "==", true)),
  );
  let created = 0;

  for (const billDoc of billsSnap.docs) {
    const bill = billDoc.data();
    const day = Math.min(Math.max(bill.dayOfMonth, 1), 28);
    const dueDate = new Date(Date.UTC(y, m - 1, day, 0, 0, 0, 0));
    const dueTs = Timestamp.fromDate(dueDate);

    // ¿ya existe un due de esta plantilla en el mes?
    const existing = await getDocs(
      query(
        duesColREAD(),
        where("userId", "==", userId),
        where("billId", "==", billDoc.id),
        where("dueDate", ">=", Timestamp.fromDate(monthStart)),
        where("dueDate", "<", Timestamp.fromDate(monthEnd)),
      ),
    );
    if (!existing.empty) continue;

    const amountPlanned =
      bill.amountType === "fixed" || bill.amountType === "estimate"
        ? bill.amount ?? 0
        : 0;

    const due: Omit<BillDue, "id"> = {
      userId,
      billId: billDoc.id,
      title: bill.title,
      currency: bill.currency,
      amountPlanned,
      amountPaid: 0,
      status: "pending",
      dueDate: dueTs,
      planAccountId: bill.defaultAccountId,
      accountId: undefined,
      createdAt: Timestamp.now(),
    };
    await addDoc(duesColWRITE(), due);
    created += 1;
  }

  return created;
}

/* ===========================================================
 *  createOneOffDue: crear vencimiento puntual (firma del ZIP)
 * =========================================================== */
export async function createOneOffDue(params: {
  uid: string;
  title: string;
  currency: string;
  dueDate: Timestamp;
  amountPlanned: number;
  planAccountId?: string;
}): Promise<string> {
  const { uid, title, currency, dueDate, amountPlanned, planAccountId } = params;

  if (!uid) throw new Error("uid requerido");
  if (!title.trim()) throw new Error("titulo requerido");
  if (!currency) throw new Error("currency requerido");
  if (!(amountPlanned >= 0)) throw new Error("amountPlanned inválido");

  const payload: Omit<BillDue, "id"> = {
    userId: uid,
    title: title.trim(),
    currency,
    amountPlanned,
    amountPaid: 0,
    status: "pending",
    dueDate,
    ...(planAccountId ? { planAccountId } : {}),
    createdAt: Timestamp.now(),
  };

  const ref = await addDoc(duesColWRITE(), payload);
  return ref.id;
}

export async function deleteDue(dueId: string): Promise<void> {
  await deleteDoc(doc(duesColREAD(), dueId));
}

/* ===========================================================
 *  payDue: pago transaccional con opción de pago parcial (por defecto permitido)
 *  Firma compatible con el ZIP: payDue(uid, dueId, accountId, amount)
 * =========================================================== */
export async function payDue(
  userId: string,
  dueId: string,
  accountId: string,
  amount: number,
): Promise<void> {
  const allowPartial = true;

  await runTransaction(db, async (tx) => {
    if (!(amount > 0)) throw new Error("Monto inválido");

    const dueRef = doc(duesColREAD(), dueId);
    const accRef = doc(accountsColREAD(), accountId);

    const [dueSnap, accSnap] = await Promise.all([tx.get(dueRef), tx.get(accRef)]);
    if (!dueSnap.exists()) throw new Error("Vencimiento no encontrado");
    if (!accSnap.exists()) throw new Error("Cuenta no encontrada");

    const due = dueSnap.data();
    const acc = accSnap.data();

    if (due.userId !== userId || acc.userId !== userId) throw new Error("Acceso denegado");
    if (acc.currency !== due.currency) throw new Error("Moneda distinta. Usa FX primero.");

    const balance = acc.balance || 0;
    let amountToPay = amount;

    if (balance < amount) {
      if (!allowPartial) throw new Error("Saldo insuficiente");
      amountToPay = balance;
      if (!(amountToPay > 0)) throw new Error("Saldo insuficiente");
    }

    // 1) Debitar cuenta
    tx.update(accRef, { balance: balance - amountToPay });

    // 2) Registrar transacción (expense)
    const tPayload: Omit<Transaction, "id"> = {
      userId,
      type: "expense",
      accountId,
      amount: amountToPay,
      currency: acc.currency,
      createdAt: Timestamp.now(),
    };
    await addDoc(transactionsColWRITE(), tPayload);

    // 3) Actualizar Due (acumulado + estado)
    const paid = (due.amountPaid || 0) + amountToPay;
    const planned = due.amountPlanned || 0;
    const status: BillDue["status"] =
      planned > 0 && paid >= planned ? "paid" : paid > 0 ? "partial" : "pending";

    tx.update(dueRef, {
      amountPaid: paid,
      status,
      accountId, // última cuenta usada
    });
  });
}
