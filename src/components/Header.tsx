"use client";
import ThemeSwitcher from "./ThemeSwitcher";

export default function Header(){
  return (
    <header className="border-b border-slate-200/70 dark:border-slate-700/60">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold">My Accountant App</span>
          <span className="text-xs opacity-60">— auth + holdings + CRUD</span>
        </div>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
