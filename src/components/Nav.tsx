"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Nav(){
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <nav className="border-b border-slate-200/70 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-950/40">
      <div className="mx-auto max-w-5xl px-4 py-2 flex items-center justify-between">
        <ul className="flex items-center gap-4 text-sm">
          <li><Link href="/" className="opacity-80 hover:opacity-100">Panel</Link></li>
          <li><Link href="/money" className="opacity-80 hover:opacity-100">Entidades y Cuentas</Link></li>
          <li><Link href="/spending" className="opacity-80 hover:opacity-100">Registro mensual</Link></li>
        </ul>
        <button onClick={()=>logout()} className="text-sm rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Cerrar sesión</button>
      </div>
    </nav>
  );
}
