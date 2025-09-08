// src/lib/types.ts
import { Timestamp } from "firebase/firestore";

/** =========================
 *  Catálogos y etiquetas
 *  ========================= */
export type InstitutionKind =
  | "bank_physical"
  | "bank_virtual"
  | "wallet"
  | "broker"
  | "crypto_exchange"
  | "cash";

/** Etiquetas por tipo de institución (usado por Money, etc.) */
export const KIND_LABELS: Record<InstitutionKind, string> = {
  bank_physical: "Banco físico",
  bank_virtual: "Banco virtual",
  wallet: "Billetera digital",
  broker: "Broker",
  crypto_exchange: "Exchange cripto",
  cash: "Efectivo",
};

/**
 * ⚠️ Necesario por Dashboard: clases de borde por tipo de institución.
 * NO remover ni cambiar el nombre de la export.
 */
export const KIND_COLORS: Record<InstitutionKind, string> = {
  bank_physical: "border-blue-300 dark:border-blue-700",
  bank_virtual: "border-sky-300 dark:border-sky-700",
  wallet: "border-emerald-300 dark:border-emerald-700",
  broker: "border-violet-300 dark:border-violet-700",
  crypto_exchange: "border-amber-300 dark:border-amber-700",
  cash: "border-slate-300 dark:border-slate-700",
};

/** Etiquetas para tipos de monto en plantillas de gasto (Spending) */
export const BILL_KIND_LABELS: Record<"fixed" | "estimate" | "variable", string> = {
  fixed: "Fijo",
  estimate: "Estimado",
  variable: "Variable",
};

/** =========================
 *  Entidades de dominio
 *  ========================= */
export type Institution = {
  id: string;
  userId: string;
  name: string;
  kind: InstitutionKind;
  createdAt: Timestamp;
};

export type Account = {
  id: string;
  userId: string;
  institutionId: string;
  name: string;
  currency: string;
  balance: number;
  createdAt: Timestamp;
};

export type BillStatus = "pending" | "partial" | "paid" | "overdue";

/** Plantilla mensual (gasto recurrente) */
export type RecurringBill = {
  id: string;
  userId: string;
  title: string;
  currency: string;      // compatibilidad
  amountType: "fixed" | "estimate" | "variable";
  amount?: number;       // requerido cuando amountType === "fixed"
  dayOfMonth: number;    // 1..28
  active: boolean;
  defaultAccountId?: string;
  createdAt: Timestamp;
};

/** Ítem planificado para el mes (vencimiento) */
export type BillDue = {
  id: string;
  userId: string;
  billId?: string;       // opcional para one-off
  title: string;
  currency: string;      // compatibilidad
  amountPlanned: number; // plan del mes
  amountPaid: number;    // suma de pagos
  status: BillStatus;
  dueDate: Timestamp;    // Timestamp consistente en toda la app
  planAccountId?: string;
  accountId?: string;    // si ya tiene cuenta seleccionada
  createdAt: Timestamp;
};

/** Pago realizado contra un vencimiento */
export type Payment = {
  id: string;
  userId: string;
  dueId: string;
  amount: number;
  accountId: string;
  date: Timestamp;      // fecha efectiva del pago
  note?: string;
  createdAt: Timestamp;
};

/** (Opcional) Transacciones generales si las necesitas tipadas aquí */
export type Transaction = {
  id: string;
  userId: string;
  type: "income" | "expense" | "transfer" | "fx";
  accountId?: string;
  amount?: number;
  currency?: string;
  fromAccountId?: string;
  toAccountId?: string;
  sellAmount?: number;
  sellCurrency?: string;
  buyAmount?: number;
  buyCurrency?: string;
  rate?: number;
  note?: string;
  createdAt: Timestamp;
};

/** =========================
 *  Helpers compartidos
 *  ========================= */

/** Formateo de dinero tabular simple */
export function money(n?: number | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 8 });
}

/** dd/mm/yyyy desde Timestamp o Date (para UI) */
export function fmtDMYfromTs(tsOrDate: { toDate?: () => Date } | Date): string {
  const d = typeof (tsOrDate as any)?.toDate === "function"
    ? (tsOrDate as any).toDate()
    : (tsOrDate as Date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
