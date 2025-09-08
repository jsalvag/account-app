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

export const KIND_LABELS: Record<InstitutionKind, string> = {
  bank_physical: "Banco físico",
  bank_virtual: "Banco virtual",
  wallet: "Billetera digital",
  broker: "Broker",
  crypto_exchange: "Exchange cripto",
  cash: "Efectivo",
};

export const KIND_COLORS: Record<InstitutionKind, string> = {
  bank_physical: "border-blue-300 dark:border-blue-700",
  bank_virtual: "border-sky-300 dark:border-sky-700",
  wallet: "border-emerald-300 dark:border-emerald-700",
  broker: "border-violet-300 dark:border-violet-700",
  crypto_exchange: "border-amber-300 dark:border-amber-700",
  cash: "border-slate-300 dark:border-slate-700",
};

/** =========================
 *  Plantillas / Gastos
 *  ========================= */
export const BILL_KIND_LABELS: Record<"fixed" | "estimate" | "variable", string> = {
  fixed: "Fijo",
  estimate: "Estimado",
  variable: "Variable",
};

/** =========================
 *  Monedas / Cripto
 *  ========================= */
export const CRYPTO_TICKERS = [
  "BTC","ETH","USDT","USDC","SOL","ADA","BNB","DOGE","MATIC","DOT",
] as const;

export type CryptoTicker = typeof CRYPTO_TICKERS[number];

export function isCryptoTicker(code: string): boolean {
  const up: string = code.toUpperCase();
  return (CRYPTO_TICKERS as readonly string[]).includes(up);
}

/** =========================
 *  Entidades del dominio
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
  currency: string; // compatibilidad actual
  balance: number;
  createdAt: Timestamp;
};

export type BillStatus = "pending" | "partial" | "paid" | "overdue";

export type RecurringBill = {
  id: string;
  userId: string;
  title: string;
  currency: string;
  amountType: "fixed" | "estimate" | "variable";
  amount?: number;
  dayOfMonth: number; // 1..28
  active: boolean;
  defaultAccountId?: string;
  createdAt: Timestamp;
};

export type BillDue = {
  id: string;
  userId: string;
  billId?: string;
  title: string;
  currency: string;
  amountPlanned: number;
  amountPaid: number;
  status: BillStatus;
  dueDate: Timestamp;
  planAccountId?: string;
  accountId?: string;
  createdAt: Timestamp;
};

export type Payment = {
  id: string;
  userId: string;
  dueId: string;
  amount: number;
  accountId: string;
  date: Timestamp;
  note?: string;
  createdAt: Timestamp;
};

export type TransactionType = "income" | "expense" | "transfer" | "fx";

export type Transaction = {
  id: string;
  userId: string;
  type: TransactionType;
  accountId?: string;
  amount?: number;
  currency?: string;
  fromAccountId?: string;
  toAccountId?: string;
  // fx
  sellAmount?: number;
  sellCurrency?: string;
  buyAmount?: number;
  buyCurrency?: string;
  rate?: number;
  createdAt: Timestamp;
};

/** =========================
 *  Tipos de UI (props y agregados)
 *  ========================= */
export type InstAgg = {
  instId: string;
  instName: string;
  instKind: InstitutionKind;
  /** sumas sólo dentro de una misma moneda */
  perCurrency: Map<string, number>;
  /** detalle por ticker cripto (sin mezclar con otras) */
  perCrypto: Map<string, number>;
};

export type InstitutionCardProps = {
  agg: InstAgg;
  onOpen: (agg: InstAgg) => void;
};

export type TransactionsSectionProps = {
  transactions: Transaction[];
  accounts: Account[];
  title?: string;
  limit?: number;
  collapsedByDefault?: boolean;
};

export type MonthlyExpensesSectionProps = {
  dues: BillDue[];
  month: string;
  onChangeMonth: (m: string) => void;
};

/** =========================
 *  Helpers comunes
 *  ========================= */
export function money(n?: number | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 8 });
}

/** Exportamos el tipo para usarlo en los componentes */
export type HasToDate = { toDate: () => Date };

function isHasToDate(v: unknown): v is HasToDate {
  return typeof v === "object" && v !== null && "toDate" in v && typeof (v as HasToDate).toDate === "function";
}

export function fmtDMYfromTs(tsOrDate: HasToDate | Date): string {
  const d: Date = isHasToDate(tsOrDate) ? tsOrDate.toDate() : tsOrDate;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
