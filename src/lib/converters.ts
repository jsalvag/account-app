// src/lib/converters.ts
import {
  FieldValue,
  Timestamp,
  WithFieldValue,
  DocumentData,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from "firebase/firestore";

type DateLikeKeys = "createdAt" | "dueDate" | "postedAt" | "closingAt" | "dueAt";

const asDate = (v: unknown): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  return undefined;
};

const toTS = (v: Date | FieldValue | undefined): Date | FieldValue | Timestamp | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return Timestamp.fromDate(v);
  return v; // respeta serverTimestamp()
};

export const dateConverter = <T extends object>() => ({
  toFirestore: (data: WithFieldValue<T>): DocumentData => {
    const out: Record<string, unknown> = {};

    // Copia solo claves definidas
    Object.keys(data as Record<string, unknown>).forEach((k) => {
      const v = (data as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = v;
    });

    // Normaliza campos de fecha
    (["createdAt", "dueDate", "postedAt", "closingAt", "dueAt"] as DateLikeKeys[]).forEach((k) => {
      if (k in out) out[k] = toTS(out[k] as Date | FieldValue | undefined);
    });

    return out;
  },
  fromFirestore: (snap: QueryDocumentSnapshot, _opts: SnapshotOptions): T => {
    const raw = snap.data() as Record<string, unknown>;
    const out: Record<string, unknown> = {id: snap.id, ...raw};

    (["createdAt", "dueDate", "postedAt", "closingAt", "dueAt"] as DateLikeKeys[]).forEach((k) => {
      out[k] = asDate(raw[k]);
    });
    return out as T;
  },
});
export const currencies = ["ARS", "USD", "EUR", "BTC", "ETH", "USDT"] as const;
export type Currency = (typeof currencies)[number];
export const amountTypes = [
  {value: "fixed", label: "Fijo"},
  {value: "estimate", label: "Estimado"},
  {value: "variable", label: "Variable"},
] as const;
export type AmountType = (typeof amountTypes)[number]["value"];