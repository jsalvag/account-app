// src/lib/types.ts

// === Catálogo de instituciones ===
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
  bank_physical: "border-sky-300 dark:border-sky-500",
  bank_virtual: "border-indigo-300 dark:border-indigo-500",
  wallet: "border-amber-300 dark:border-amber-500",
  broker: "border-emerald-300 dark:border-emerald-500",
  crypto_exchange: "border-yellow-300 dark:border-yellow-500",
  cash: "border-rose-300 dark:border-rose-500",
};

// === Entidades y Cuentas ===
export type Institution = {
  id: string;
  userId: string;
  name: string;
  kind: InstitutionKind;
  createdAt?: Date;
};

export type Account = {
  id: string;
  userId: string;
  institutionId: string;
  name: string;
  currency: string;
  balance: number;
  createdAt?: Date;
};

// === Transacciones existentes + nuevas ===
export type TxTransfer = {
  id: string;
  userId: string;
  type: "transfer";
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  createdAt?: Date;
};

export type TxFx = {
  id: string;
  userId: string;
  type: "fx";
  fromAccountId: string;
  toAccountId: string;
  sellAmount: number;
  sellCurrency: string;
  buyAmount: number;
  buyCurrency: string;
  rate: number;
  createdAt?: Date;
};

export type TxIncome = {
  id: string;
  userId: string;
  type: "income";
  accountId: string;
  amount: number;
  currency: string;
  note?: string;
  createdAt?: Date;
};

// (Usada por Spending → pagos de facturas, tarjetas, etc.)
export type TxExpense = {
  id: string;
  userId: string;
  type: "expense";
  accountId: string;
  amount: number;       // Monto debitado (positivo)
  currency: string;
  title?: string;       // Ej.: "Alquiler", "Visa setiembre"
  createdAt?: Date;
};

export type Transaction = TxTransfer | TxFx | TxIncome | TxExpense;

// === Spending: tipos estrictos con Date ===
export type RecurringBill = {
  id: string;
  userId: string;
  title: string;               // Alquiler, Expensas, Internet...
  currency: string;            // ARS, USD, etc.
  amountType: "fixed" | "estimate" | "variable";
  amount?: number;             // para fixed/estimate
  dayOfMonth: number;          // día de vencimiento (1..28/30/31)
  defaultAccountId?: string;   // cuenta sugerida para pagar
  institutionId?: string;      // proveedor (opcional)
  notes?: string;
  active: boolean;
  createdAt?: Date;
};

export type BillStatus = "pending" | "partial" | "paid" | "overdue";

export type BillDue = {
  id: string;
  userId: string;
  billId?: string;            // si proviene de RecurringBill
  title: string;              // denormalizado, queda “congelado” ese mes
  currency: string;
  amountPlanned: number;      // lo esperado (min/est/ fijo)
  amountPaid: number;         // acumulado
  dueDate: Date;
  status: BillStatus;
  accountId?: string;         // última cuenta con la que se pagó
  createdAt?: Date;
};

// Aux
export const money = (n?: number): string =>
  n === undefined ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 8 });

export const BILL_KIND_LABELS: Record<RecurringBill["amountType"], string> = {
  fixed: "Fijo",
  estimate: "Estimado",
  variable: "Variable",
};
