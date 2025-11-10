"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/logs", label: "Logs" },
  { href: "/documents", label: "Documents" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-slate-950">
      <aside
        className={`${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } fixed bottom-0 left-0 top-0 z-40 w-60 border-r border-slate-800 bg-slate-900/80 backdrop-blur transition-transform duration-200 lg:static`}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight text-white">
            Agents Hub
          </span>
          <button
            className="text-slate-400 hover:text-white lg:hidden"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>
        <nav className="mt-4 space-y-1 px-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
                onClick={() => setIsMobileOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col text-slate-100">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-slate-700 px-2 py-1 text-sm text-slate-300 hover:border-slate-500 hover:text-white lg:hidden"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open navigation"
            >
              ☰
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Multi-Agent Monitor
              </p>
              <p className="text-lg font-semibold text-white">Supabase Observatory</p>
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

