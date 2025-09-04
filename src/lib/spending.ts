// src/lib/spending.ts (sólo este archivo)

"use client";

import {db} from "./firebase";
import {
  addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy,
  query, runTransaction, where, updateDoc, deleteDoc
} from "firebase/firestore";
import {dateConverter} from "./converters";
import type {Account, BillDue, RecurringBill, TxExpense} from "./types";

// === Colecciones con converter ===
// Lectura (incluye id)
const billsColR = () => collection(db, "recurring_bills").withConverter(dateConverter<RecurringBill>());
const duesColR = () => collection(db, "bill_dues").withConverter(dateConverter<BillDue>());
// Escritura (sin id)
type NewRecurringBill = Omit<RecurringBill, "id" | "createdAt"> & { createdAt?: Date };
type NewBillDue = Omit<BillDue, "id" | "createdAt"> & { createdAt?: Date };
type NewTxExpense = Omit<TxExpense, "id" | "createdAt"> & { createdAt?: Date };

const billsColW = () => collection(db, "recurring_bills").withConverter(dateConverter<NewRecurringBill>());
const duesColW = () => collection(db, "bill_dues").withConverter(dateConverter<NewBillDue>());
const txColW = () => collection(db, "transactions").withConverter(dateConverter<NewTxExpense>());

export const createRecurringBill = (userId: string, bill: Omit<RecurringBill, "id" | "userId" | "createdAt">) =>
  addDoc(billsColW(), {
    userId,
    ...bill,
    createdAt: new Date(),
  });

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
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const q = query(duesColR(), where("userId", "==", userId), where("dueDate", ">=", start), where("dueDate", "<", end), orderBy("dueDate", "asc"), limit(500));
  return onSnapshot(q, s => set(s.docs.map(d => d.data())), e => onErr(e.message));
};

export const generateMonthDues = async (userId: string, month: string): Promise<number> => {
  const [y, m] = month.split("-").map(Number);
  const qBills = query(billsColR(), where("userId", "==", userId), where("active", "==", true), limit(500));
  const sBills = await getDocs(qBills);

  let created = 0;
  for (const d of sBills.docs) {
    const b = d.data();
    const dueDay = Math.min(b.dayOfMonth, 28);
    const dueDate = new Date(Date.UTC(y, m - 1, dueDay, 12, 0, 0));
    const planned =
      b.amountType === "fixed" ? (b.amount ?? 0) :
        b.amountType === "estimate" ? (b.amount ?? 0) :
          0;

    // evitar duplicados del mismo mes
    const qDup = query(
      duesColR(),
      where("userId", "==", userId),
      where("billId", "==", b.id),
      where("dueDate", ">=", new Date(Date.UTC(y, m - 1, 1))),
      where("dueDate", "<", new Date(Date.UTC(y, m, 1))),
      limit(1)
    );
    const sDup = await getDocs(qDup);
    if (!sDup.empty) continue;

    const payload: NewBillDue = {
      userId,
      billId: b.id,
      title: b.title,
      currency: b.currency,
      amountPlanned: planned,
      amountPaid: 0,
      dueDate,
      status: "pending",
      accountId: b.defaultAccountId,
      createdAt: new Date(),
    };
    await addDoc(duesColW(), payload);
    created += 1;
  }
  return created;
};
export const payDue = async (
  userId: string,
  dueId: string,
  accountId: string,
  amount: number
): Promise<void> => {
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

    // Debita cuenta
    tx.update(accRef, {balance: acc.balance - amount});

    // Transacción de gasto (sin id al escribir)
    const t: NewTxExpense = {
      userId,
      type: "expense",
      accountId,
      amount,
      currency: acc.currency,
      title: due.title,
      createdAt: new Date(),
    };
    tx.set(doc(txColW()), dateConverter<NewTxExpense>().toFirestore(t));

    // Actualiza el due
    const paid = due.amountPaid + amount;
    const status: BillDue["status"] =
      paid >= due.amountPlanned && due.amountPlanned > 0 ? "paid"
        : paid > 0 ? "partial"
          : "pending";

    tx.update(dueRef, {amountPaid: paid, status, accountId});
  });
};
