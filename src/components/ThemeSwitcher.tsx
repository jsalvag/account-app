"use client";
import { useEffect, useState } from "react";

export default function ThemeSwitcher(){
  const [value, setValue] = useState("sistema");
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "sistema";
    setValue(saved);
    applyTheme(saved);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if ((localStorage.getItem("theme")||"sistema")==="sistema") {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    mq?.addEventListener?.("change", handler);
    return () => mq?.removeEventListener?.("change", handler);
  }, []);

  function applyTheme(opt: string){
    const html = document.documentElement;
    html.classList.remove("dark","theme-sepia");
    if (opt==="oscuro") html.classList.add("dark");
    else if (opt==="sepia") html.classList.add("theme-sepia");
    else if (opt==="sistema") {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) html.classList.add("dark");
    }
    localStorage.setItem("theme", opt);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span>Tema</span>
      <select
        aria-label="Tema"
        value={value}
        onChange={(e)=>{ setValue(e.target.value); applyTheme(e.target.value); }}
        className="rounded-md border px-2 py-1 bg-white dark:bg-slate-800"
      >
        <option value="sistema">Sistema</option>
        <option value="claro">Claro</option>
        <option value="oscuro">Oscuro</option>
        <option value="sepia">Sepia</option>
      </select>
    </label>
  );
}
