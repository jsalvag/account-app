"use client";

import React, {JSX, useEffect, useState} from "react";
import Modal from "@/components/ui/Modal";
import {AmountType, amountTypes, currencies, Currency} from "@/lib/converters";
import {RecurringBill} from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    currency: Currency;
    amountType: RecurringBill["amountType"];
    amount?: number;
    dayOfMonth: number;
    defaultAccountId?: string;
  }) => Promise<void>;
  renderAccountOptgroups: (filterCurrency?: string) => JSX.Element[];
  initial?: Partial<RecurringBill>;
  submitLabel?: string;
};

export default function TemplateModal({
                                        open,
                                        onClose,
                                        onSubmit,
                                        renderAccountOptgroups,
                                        initial,
                                        submitLabel = "Guardar"
                                      }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [currency, setCurrency] = useState<Currency>((initial?.currency as Currency) ?? "ARS");
  const [amountType, setAmountType] = useState<AmountType>((initial?.amountType as AmountType) ?? "fixed");
  const [amount, setAmount] = useState<number | "">(initial?.amount ?? "");
  const [dayOfMonth, setDayOfMonth] = useState<number>(initial?.dayOfMonth ?? 1);
  const [defaultAccountId, setDefaultAccountId] = useState<string>(initial?.defaultAccountId ?? "");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setCurrency((initial?.currency as Currency) ?? "ARS");
    setAmountType((initial?.amountType as AmountType) ?? "fixed");
    setAmount(initial?.amount ?? "");
    setDayOfMonth(initial?.dayOfMonth ?? 1);
    setDefaultAccountId(initial?.defaultAccountId ?? "");
  }, [open, initial]);

  return (
    <Modal open={open} onClose={onClose} title="Plantilla mensual" size="lg"
           footer={
             <div className="flex justify-end">
               <button className="rounded-md border px-4 py-2" onClick={onClose}>Cancelar</button>
               <button
                 className="ml-2 rounded-md border px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                 onClick={async () => {
                   await onSubmit({
                     title: title.trim(),
                     currency,
                     amountType,
                     amount: amount === "" ? undefined : Number(amount),
                     dayOfMonth: Math.max(1, Math.min(28, dayOfMonth)),
                     defaultAccountId: defaultAccountId || undefined,
                   });
                 }}
               >
                 {submitLabel}
               </button>
             </div>
           }
    >
      <div className="grid gap-3 md:grid-cols-6 items-end">
        <div className="md:col-span-2">
          <label className="text-xs opacity-70 mb-1 block">Nombre</label>
          <input className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
                 value={title} onChange={e => setTitle(e.target.value)}
                 placeholder="Alquiler, Expensas…"/>
        </div>
        <div>
          <label className="text-xs opacity-70 mb-1 block">Moneda</label>
          <select className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
                  value={currency} onChange={e => setCurrency(e.target.value as Currency)}>
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs opacity-70 mb-1 block">Tipo</label>
          <select className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
                  value={amountType} onChange={e => setAmountType(e.target.value as AmountType)}>
            {amountTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs opacity-70 mb-1 block">Monto (opcional)</label>
          <input type="number" step="0.01" placeholder="0,00"
                 className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800 text-right tabular-nums"
                 value={amount}
                 onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))}/>
        </div>
        <div>
          <label className="text-xs opacity-70 mb-1 block">Día</label>
          <input type="number" min={1} max={28}
                 className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
                 value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))}/>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs opacity-70 mb-1 block">Cuenta por defecto</label>
          <select className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
                  value={defaultAccountId} onChange={e => setDefaultAccountId(e.target.value)}>
            <option value="">(opcional)</option>
            {renderAccountOptgroups()}
          </select>
        </div>
      </div>
    </Modal>
  );
}
