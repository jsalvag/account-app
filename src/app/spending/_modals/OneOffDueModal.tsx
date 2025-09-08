"use client";

import React, {JSX, useEffect, useState} from "react";
import Modal from "@/components/ui/Modal";
import {currencies, Currency} from "@/lib/converters";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    currency: Currency;
    dateISO: string;      // yyyy-mm-dd
    amountPlanned?: number;
    planAccountId?: string;
  }) => Promise<void>;
  renderAccountOptgroups: (filterCurrency?: string) => JSX.Element[];
};

export default function OneOffDueModal({open, onClose, onSubmit, renderAccountOptgroups}: Props) {
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [dateISO, setDateISO] = useState("");
  const [amountPlanned, setAmountPlanned] = useState<string>("");
  const [planAccountId, setPlanAccountId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setTitle(""); setCurrency("ARS"); setDateISO(""); setAmountPlanned(""); setPlanAccountId("");
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Agregar gasto puntual" size="lg"
           footer={
             <div className="flex justify-end">
               <button className="rounded-md border px-4 py-2" onClick={onClose}>Cancelar</button>
               <button
                 className="ml-2 rounded-md border px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                 onClick={async () => {
                   await onSubmit({
                     title: title.trim(),
                     currency,
                     dateISO,
                     amountPlanned: amountPlanned === "" ? undefined : Number(amountPlanned),
                     planAccountId: planAccountId || undefined,
                   });
                 }}
               >Agregar</button>
             </div>
           }
    >
      <div className="grid gap-3 md:grid-cols-6 items-end">
        <div className="md:col-span-2">
          <label className="text-xs opacity-70 mb-1 block">Concepto</label>
          <input className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
                 value={title} onChange={e => setTitle(e.target.value)} placeholder="Gasto puntual…" />
        </div>
        <div>
          <label className="text-xs opacity-70 mb-1 block">Moneda</label>
          <select className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
                  value={currency} onChange={e => setCurrency(e.target.value as Currency)}>
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs opacity-70 mb-1 block">Fecha</label>
          <input type="date" className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
                 value={dateISO} onChange={e => setDateISO(e.target.value)} title="dd/mm/yyyy"/>
        </div>
        <div>
          <label className="text-xs opacity-70 mb-1 block">Plan</label>
          <input type="number" step="0.01" min={0} placeholder="0,00"
                 className="w-full text-right tabular-nums rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
                 value={amountPlanned} onChange={e => setAmountPlanned(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs opacity-70 mb-1 block">Cuenta sugerida</label>
          <select className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
                  value={planAccountId} onChange={e => setPlanAccountId(e.target.value)}>
            <option value="">(opcional)</option>
            {renderAccountOptgroups(currency)}
          </select>
        </div>
      </div>
    </Modal>
  );
}
