// src/lib/converters.ts
import {
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";

/**
 * Conversor genérico para colecciones de Firestore.
 * - En `fromFirestore` agrega `id` del documento al objeto resultante.
 * - En `toFirestore` elimina `id` si estuviera presente.
 */
export function dateConverter<T>(): FirestoreDataConverter<T> {
  return {
    toFirestore(modelObject: T): DocumentData {
      const base: Record<string, unknown> = {
        ...(modelObject as unknown as Record<string, unknown>),
      };
      if ("id" in base) {
        const { id: _omit, ...rest } = base;
        return rest;
      }
      return base;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      const data = snapshot.data(options) as Record<string, unknown>;
      const out: Record<string, unknown> = { id: snapshot.id, ...data };
      return out as T;
    },
  };
}

/* ============================================================
 * Catálogos y tipos usados por la UI
 * ============================================================ */

/** Constantes de valor para usar en comparaciones en runtime. */
export const AMOUNT_TYPE = {
  fixed: "fixed",
  estimate: "estimate",
  variable: "variable",
} as const;

/** Array utilitario (por si hay selects, etc.) */
export const amountTypes = [
  AMOUNT_TYPE.fixed,
  AMOUNT_TYPE.estimate,
  AMOUNT_TYPE.variable,
] as const;

/** Tipo de AmountType (sólo en tiempo de compilación). */
export type AmountType = typeof amountTypes[number];

/**
 * Lista de monedas sugeridas para la UI.
 * No limita el dominio: `Currency` es string para compatibilidad
 * con códigos existentes (fiat y cripto).
 */
export const currencyList = ["ARS", "USD", "BTC", "ETH", "USDT", "USDC"] as const;

/** Tipo de moneda amplio (compatibilidad con datos existentes). */
export type Currency = string;
