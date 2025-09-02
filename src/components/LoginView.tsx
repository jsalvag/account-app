"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function LoginView(){
  const { login, register, reset } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{text:string,color?:"ok"|"err"}|null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent){
    e.preventDefault(); setBusy(true); setMsg(null);
    try { await login(email.trim(), password); }
    catch (err:any){ setMsg({text: err?.message || "Error", color:"err"}); }
    finally{ setBusy(false); }
  }
  async function handleRegister(){ setMsg(null);
    try { await register(email.trim(), password); setMsg({text:"Cuenta creada. Sesión iniciada.", color:"ok"}); }
    catch (err:any){ setMsg({text: err?.message || "Error", color:"err"}); }
  }
  async function handleReset(){
    try { await reset(email.trim()); setMsg({text:"Enviamos un enlace para restablecer.", color:"ok"}); }
    catch (err:any){ setMsg({text: err?.message || "Error", color:"err"}); }
  }

  return (
    <section className="max-w-md mx-auto">
      <div className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h1 className="text-2xl font-semibold mb-1">Accede a tu cuenta</h1>
        <p className="text-sm opacity-70 mb-6">Control económico y financiero personal</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="password">Contraseña</label>
            <input id="password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}
              className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
          </div>
          <div className={`text-sm h-5 ${msg ? (msg.color==="ok"?"text-emerald-600":"text-rose-600") : ""}`}>
            {msg?.text || ""}
          </div>
          <div className="flex items-center gap-2">
            <button disabled={busy} type="submit" className="rounded-md px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90">Ingresar</button>
            <button type="button" onClick={handleRegister} className="rounded-md px-3 py-2 border border-slate-300 dark:border-slate-700">Crear cuenta</button>
            <button type="button" onClick={handleReset} className="text-sm opacity-80 hover:opacity-100">Olvidé mi contraseña</button>
          </div>
        </form>
      </div>
    </section>
  );
}
