"use client";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUserCollections, money, createInstitution, createAccount, updateInstitution, deleteInstitutionCascade, updateAccount, deleteAccount, transfer, fx } from "@/lib/useCollections";
import { KIND_LABELS } from "@/lib/types";

export default function Money(){
  const { user } = useAuth();
  const uid = user?.uid!;
  const { institutions, accounts, setErr } = useUserCollections(uid);

  // Forms state
  const [instName, setInstName] = useState("");
  const [instKind, setInstKind] = useState<keyof typeof KIND_LABELS>("bank_physical");
  const [acctInst, setAcctInst] = useState("");
  const [acctName, setAcctName] = useState("");
  const [acctCurr, setAcctCurr] = useState("ARS");
  const [acctInit, setAcctInit] = useState<number | "">("");

  const [xFrom, setXFrom] = useState(""); const [xTo, setXTo] = useState(""); const [xAmt, setXAmt] = useState<number| "">("");
  const [fFrom, setFFrom] = useState(""); const [fTo, setFTo] = useState(""); const [fAmt, setFAmt] = useState<number| "">(""); const [fRate, setFRate] = useState<number| "">("");

  const accOptions = useMemo(()=>accounts.map(a=>{
    const inst = institutions.find(i=>i.id===a.institutionId);
    return { id:a.id, label: `${inst?.name ?? "(??)"} — ${a.name} [${a.currency}] — ${money(a.balance)}`, currency: a.currency };
  }), [accounts, institutions]);

  const xToOptions = useMemo(()=>{
    if (!xFrom) return [];
    const from = accounts.find(a=>a.id===xFrom);
    if (!from) return [];
    return accOptions.filter(o=> o.id!==xFrom && o.currency===from.currency);
  }, [xFrom, accounts, accOptions]);

  const fToOptions = useMemo(()=>{
    if (!fFrom) return [];
    const from = accounts.find(a=>a.id===fFrom);
    if (!from) return [];
    return accOptions.filter(o=> o.id!==fFrom && o.currency!==from.currency);
  }, [fFrom, accounts, accOptions]);

  async function onCreateInstitution(e: React.FormEvent){
    e.preventDefault();
    if (!instName.trim()) return;
    try { await createInstitution(uid, instName.trim(), instKind); setInstName(""); }
    catch (e:any){ setErr?.(e.message||String(e)); }
  }

  async function onCreateAccount(e: React.FormEvent){
    e.preventDefault();
    if (!acctInst || !acctName.trim()) return;
    const init = Number(acctInit || 0);
    try { await createAccount(uid, acctInst, acctName.trim(), acctCurr, isFinite(init)?init:0); setAcctName(""); setAcctInit(""); }
    catch (e:any){ setErr?.(e.message||String(e)); }
  }

  async function onTransfer(e: React.FormEvent){
    e.preventDefault();
    const amt = Number(xAmt||0); if (!xFrom || !xTo || !(amt>0)) return;
    try { await transfer(uid, xFrom, xTo, amt); setXFrom(""); setXTo(""); setXAmt(""); }
    catch (e:any){ setErr?.(e.message||String(e)); }
  }

  async function onFx(e: React.FormEvent){
    e.preventDefault();
    const amt = Number(fAmt||0), rate = Number(fRate||0);
    if (!fFrom || !fTo || !(amt>0) || !(rate>0)) return;
    try { await fx(uid, fFrom, fTo, amt, rate); setFFrom(""); setFTo(""); setFAmt(""); setFRate(""); }
    catch (e:any){ setErr?.(e.message||String(e)); }
  }

  return (
    <div className="grid gap-6">
      {/* ENTIDADES */}
      <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h3 className="text-xl font-semibold mb-3">Entidades</h3>
        <form onSubmit={onCreateInstitution} className="grid gap-2 md:grid-cols-3 mb-3">
          <input value={instName} onChange={e=>setInstName(e.target.value)} placeholder="Nombre de la entidad" className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800 md:col-span-2"/>
          <select value={instKind} onChange={e=>setInstKind(e.target.value as any)} className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800">
            <option value="bank_physical">Banco físico</option>
            <option value="bank_virtual">Banco virtual</option>
            <option value="wallet">Billetera digital</option>
            <option value="broker">Broker</option>
            <option value="crypto_exchange">Exchange cripto</option>
            <option value="cash">Efectivo</option>
          </select>
          <button className="md:col-span-3 rounded-md px-3 py-2 border border-slate-300 dark:border-slate-700">Agregar entidad</button>
        </form>

        <div className="overflow-x-auto mb-6">
          <table className="min-w-full w-full text-sm">
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pl-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map(i=>(
                <tr key={i.id} className="border-t border-slate-200/60 dark:border-slate-800/60">
                  <td className="py-2 pr-4">{i.name}</td>
                  <td className="py-2 pr-4">{KIND_LABELS[i.kind]}</td>
                  <td className="py-2 pl-4 text-right">
                    <button onClick={async ()=>{
                      const nn = prompt("Nuevo nombre de la entidad:", i.name||""); if (nn===null) return;
                      const kinds = ["bank_physical","bank_virtual","wallet","broker","crypto_exchange","cash"] as const;
                      const nk = prompt("Tipo (bank_physical, bank_virtual, wallet, broker, crypto_exchange, cash):", i.kind) as any; if (nk===null || !kinds.includes(nk)) return;
                      await updateInstitution(i.id, { name: String(nn).trim(), kind: nk });
                    }} className="text-xs rounded-md px-2 py-1 border mr-2">Editar</button>
                    <button onClick={async ()=>{
                      if (!confirm(`¿Eliminar entidad "${i.name}" y sus cuentas?`)) return;
                      await deleteInstitutionCascade(uid, i.id);
                    }} className="text-xs rounded-md px-2 py-1 border">Borrar</button>
                  </td>
                </tr>
              ))}
              {institutions.length===0 && <tr><td colSpan={3} className="py-4 text-center opacity-60">Sin entidades aún</td></tr>}
            </tbody>
          </table>
        </div>

        {/* CUENTAS */}
        <h4 className="font-medium mb-2">Cuentas</h4>
        <form onSubmit={onCreateAccount} className="grid gap-2 md:grid-cols-5 mb-3">
          <select value={acctInst} onChange={e=>setAcctInst(e.target.value)} className="md:col-span-2 rounded-md border px-3 py-2 bg-white dark:bg-slate-800">
            <option value="">Selecciona entidad…</option>
            {institutions.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input value={acctName} onChange={e=>setAcctName(e.target.value)} placeholder="Nombre de la cuenta" className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800"/>
          <select value={acctCurr} onChange={e=>setAcctCurr(e.target.value)} className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800">
            <option>ARS</option><option>USD</option><option>EUR</option><option>BTC</option><option>ETH</option><option>USDT</option>
          </select>
          <input value={acctInit} onChange={e=>setAcctInit(e.target.value as any)} type="number" step="0.01" placeholder="Saldo inicial (opcional)" className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800"/>
          <button className="md:col-span-5 rounded-md px-3 py-2 border border-slate-300 dark:border-slate-700">Agregar cuenta</button>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full w-full text-sm">
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-2 pr-4">Entidad</th>
                <th className="py-2 pr-4">Cuenta</th>
                <th className="py-2 pr-4">Moneda</th>
                <th className="py-2 pr-4">Saldo</th>
                <th className="py-2 pl-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a=>{
                const inst = institutions.find(i=>i.id===a.institutionId);
                return (
                  <tr key={a.id} className="border-t border-slate-200/60 dark:border-slate-800/60">
                    <td className="py-2 pr-4">{inst?.name||""}</td>
                    <td className="py-2 pr-4">{a.name}</td>
                    <td className="py-2 pr-4">{a.currency}</td>
                    <td className="py-2 pr-4">{money(a.balance)}</td>
                    <td className="py-2 pl-4 text-right">
                      <button onClick={async ()=>{
                        const nn = prompt("Nuevo nombre de cuenta:", a.name||""); if (nn===null) return;
                        const allowed = ["ARS","USD","EUR","BTC","ETH","USDT"];
                        const nc = prompt("Moneda (ARS, USD, EUR, BTC, ETH, USDT):", a.currency||"ARS")||"";
                        if (!allowed.includes(nc)) return;
                        await updateAccount(a.id, { name: String(nn).trim(), currency: nc });
                      }} className="text-xs rounded-md px-2 py-1 border mr-2">Editar</button>
                      <button onClick={async ()=>{ if(!confirm(`¿Eliminar cuenta "${a.name}"?`)) return; await deleteAccount(a.id); }} className="text-xs rounded-md px-2 py-1 border">Borrar</button>
                    </td>
                  </tr>
                );
              })}
              {accounts.length===0 && <tr><td colSpan={5} className="py-4 text-center opacity-60">Sin cuentas aún</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* TRANSFER & FX */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-lg font-semibold mb-3">Transferir (misma moneda)</h3>
          <form onSubmit={onTransfer} className="grid gap-2">
            <select value={xFrom} onChange={e=>{ setXFrom(e.target.value); setXTo(""); setXAmt(""); }} className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800">
              <option value="">Selecciona cuenta origen…</option>
              {accOptions.map(o=> <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <select value={xTo} onChange={e=>setXTo(e.target.value)} disabled={!xFrom} className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800">
              <option value="">{xFrom ? "Selecciona cuenta destino…" : "Selecciona origen primero…"}</option>
              {xToOptions.map(o=> <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <input value={xAmt} onChange={e=>setXAmt(e.target.value as any)} type="number" step="0.01" placeholder="Monto" className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800"/>
            <button className="rounded-md px-3 py-2 border border-slate-300 dark:border-slate-700">Transferir</button>
          </form>
        </div>

        <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-lg font-semibold mb-3">Cambio de divisas (FX)</h3>
          <form onSubmit={onFx} className="grid gap-2">
            <select value={fFrom} onChange={e=>{ setFFrom(e.target.value); setFTo(""); setFAmt(""); setFRate(""); }} className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800">
              <option value="">Selecciona cuenta origen…</option>
              {accOptions.map(o=> <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <input value={fAmt} onChange={e=>setFAmt(e.target.value as any)} type="number" step="0.01" placeholder="Monto a vender" className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800"/>
            <select value={fTo} onChange={e=>setFTo(e.target.value)} disabled={!fFrom} className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800">
              <option value="">{fFrom ? "Selecciona cuenta destino…" : "Selecciona origen primero…"}</option>
              {fToOptions.map(o=> <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <input value={fRate} onChange={e=>setFRate(e.target.value as any)} type="number" step="0.0001" placeholder="Tasa (to/from)" className="rounded-md border px-3 py-2 bg-white dark:bg-slate-800"/>
            <button className="rounded-md px-3 py-2 border border-slate-300 dark:border-slate-700">Convertir</button>
          </form>
        </div>
      </div>
    </div>
  );
}
