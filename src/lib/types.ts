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

export const KIND_COLORS: Record<string, string> = {
  bank_physical: "border-sky-300 dark:border-sky-500",
  bank_virtual: "border-indigo-300 dark:border-indigo-500",
  wallet: "border-amber-300 dark:border-amber-500",
  broker: "border-emerald-300 dark:border-emerald-500",
  crypto_exchange: "border-yellow-300 dark:border-yellow-500",
  cash: "border-rose-300 dark:border-rose-500",
};

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

export type Transaction = TxTransfer | TxFx;
