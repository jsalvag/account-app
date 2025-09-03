"use client";
import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import type { Account, Institution, Transaction } from "./types";
import {
  collection, onSnapshot, query, where, orderBy, limit,
  addDoc, doc, deleteDoc, updateDoc, runTransaction, serverTimestamp, getDocs
} from "firebase/firestore";

export function useUserCollections(userId?: string|null) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (!userId) { setInstitutions([]); setAccounts([]); setTransactions([]); return; }
    setErr("");
    const qInst = query(collection(db, "institutions"), where("userId","==", userId));
    const qAcc  = query(collection(db, "accounts"), where("userId","==", userId));
    const qTx   = query(collection(db, "transactions"), where("userId","==", userId), orderBy("createdAt","desc"), limit(10));

    const unsubInst = onSnapshot(qInst, s => setInstitutions(s.docs.map(d=>({id:d.id, ...(d.data() as any)}))), e => setErr(`institutions: ${e.message||e}`));
    const unsubAcc  = onSnapshot(qAcc,  s => setAccounts(s.docs.map(d=>({id:d.id, ...(d.data() as any)}))), e => setErr(`accounts: ${e.message||e}`));
    const unsubTx   = onSnapshot(qTx,   s => setTransactions(s.docs.map(d=>({id:d.id, ...(d.data() as any)}))), e => setErr(`transactions: ${e.message||e}`));

    return () => { unsubInst(); unsubAcc(); unsubTx(); };
  }, [userId]);

  const byCurrency = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of accounts) m[a.currency] = (m[a.currency]||0) + Number(a.balance||0);
    return m;
  }, [accounts]);

  return { institutions, accounts, transactions, byCurrency, err, setErr };
}

/** CRUD & Ops */
export async function createInstitution(userId: string, name: string, kind: string) {
  await addDoc(collection(db, "institutions"), { userId, name, kind, createdAt: serverTimestamp() });
}
export async function updateInstitution(id: string, data: Partial<Institution>) {
  await updateDoc(doc(db, "institutions", id), data as any);
}
export async function deleteInstitutionCascade(userId: string, id: string) {
  // Borrar cuentas de la institución y luego la institución.
  const accQ = query(collection(db, "accounts"), where("userId","==", userId), where("institutionId","==", id));
  const accSnap = await getDocs(accQ);
  for (const d of accSnap.docs) {
    await deleteDoc(d.ref);
  }
  await deleteDoc(doc(db, "institutions", id));
}

export async function createAccount(userId: string, institutionId: string, name: string, currency: string, balance: number) {
  await addDoc(collection(db, "accounts"), { userId, institutionId, name, currency, balance, createdAt: serverTimestamp() });
}
export async function updateAccount(id: string, data: Partial<Account>) {
  await updateDoc(doc(db, "accounts", id), data as any);
}
export async function deleteAccount(id: string) {
  await deleteDoc(doc(db, "accounts", id));
}

export async function transfer(userId: string, fromId: string, toId: string, amount: number) {
  await runTransaction(db, async (tx) => {
    const fromRef = doc(db, "accounts", fromId);
    const toRef   = doc(db, "accounts", toId);
    const [fs, ts] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
    if (!fs.exists() || !ts.exists()) throw new Error("Cuenta no encontrada");
    const f = fs.data() as Account; const t = ts.data() as Account;
    if (f.userId !== userId || t.userId !== userId) throw new Error("Acceso denegado");
    if (f.currency !== t.currency) throw new Error("Monedas distintas");
    if ((f.balance||0) < amount) throw new Error("Saldo insuficiente");
    tx.update(fromRef, { balance: (f.balance||0) - amount });
    tx.update(toRef,   { balance: (t.balance||0) + amount });
    const txRef = doc(collection(db, "transactions"));
    tx.set(txRef, {
      userId, type:"transfer", fromAccountId: fromId, toAccountId: toId,
      amount, currency: f.currency, createdAt: serverTimestamp()
    } as any);
  });
}

export async function fx(userId: string, fromId: string, toId: string, sellAmount: number, rate: number) {
  await runTransaction(db, async (tx) => {
    const fromRef = doc(db, "accounts", fromId);
    const toRef   = doc(db, "accounts", toId);
    const [fs, ts] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
    if (!fs.exists() || !ts.exists()) throw new Error("Cuenta no encontrada");
    const f = fs.data() as Account; const t = ts.data() as Account;
    if (f.userId !== userId || t.userId !== userId) throw new Error("Acceso denegado");
    if (f.currency === t.currency) throw new Error("Para FX las monedas deben ser distintas");
    if ((f.balance||0) < sellAmount) throw new Error("Saldo insuficiente");
    const buyAmount = sellAmount * rate;
    tx.update(fromRef, { balance: (f.balance||0) - sellAmount });
    tx.update(toRef,   { balance: (t.balance||0) + buyAmount });
    const txRef = doc(collection(db, "transactions"));
    tx.set(txRef, {
      userId, type:"fx", fromAccountId: fromId, toAccountId: toId,
      sellAmount, sellCurrency: f.currency, buyAmount, buyCurrency: t.currency,
      rate, createdAt: serverTimestamp()
    } as any);
  });
}
export async function income(userId: string, accountId: string, amount: number, note?: string) {
  await runTransaction(db, async (tx) => {
    const aRef = doc(db, "accounts", accountId);
    const aSnap = await tx.get(aRef);
    if (!aSnap.exists()) throw new Error("Cuenta no encontrada");
    const a = aSnap.data() as Account;
    if (a.userId !== userId) throw new Error("Acceso denegado");
    tx.update(aRef, { balance: (a.balance||0) + amount });
    const txRef = doc(collection(db, "transactions"));
    tx.set(txRef, {
      userId, type:"income", accountId, amount, currency: a.currency,
      note, createdAt: serverTimestamp()
    } as any);
  });
}

export function money(n?: number|null) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 8 });
}
