"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon, Logo, type IconName } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { dueCount } from "@/lib/srs";
import { formatRelative } from "@/lib/utils";
import { EngineBadge } from "@/components/ui/EngineBadge";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Library", icon: "library" },
  { href: "/new", label: "Create", icon: "sparkle" },
  { href: "/review", label: "Review due", icon: "refresh" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sets, subjects } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const due = useMemo(
    () => sets.reduce((n, s) => n + dueCount(s.content.flashcards), 0),
    [sets]
  );

  const recent = useMemo(
    () =>
      [...sets]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .filter((s) => !query || s.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8),
    [sets, query]
  );

  const content = (
    <div className="flex h-full flex-col gap-5 overflow-hidden">
      <Link href="/" className="flex items-center gap-2.5 px-1" onClick={() => setOpen(false)}>
        <Logo size={22} />
        <span className="text-[1.05rem] font-extrabold tracking-tight text-white">
          Storm<span className="text-gradient">Learn</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-white/8 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <Icon name={item.icon} size={18} className={active ? "text-brand-300" : ""} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/review" && due > 0 && (
                <span className="rounded-full bg-accent-400/20 px-2 py-0.5 text-[11px] font-bold text-accent-300">
                  {due}
                </span>
              )}
              {active && <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand-400 to-punch-400" />}
            </Link>
          );
        })}
      </nav>

      <Link href="/new" onClick={() => setOpen(false)} className="btn btn-primary w-full">
        <Icon name="plus" size={16} />
        New study set
      </Link>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Recent</span>
          <span className="text-[11px] font-semibold text-slate-600">{sets.length}</span>
        </div>
        <div className="relative">
          <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter sets"
            className="input !py-1.5 !pl-8 !text-xs"
          />
        </div>
        <div className="no-scrollbar -mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
          {recent.length === 0 ? (
            <p className="px-2 py-3 text-xs leading-relaxed text-slate-600">
              {sets.length === 0
                ? "Nothing yet. Drop in a lecture, PDF or YouTube link and StormLearn builds the rest."
                : "No sets match that filter."}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/set/${s.id}`}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] transition ${
                      pathname === `/set/${s.id}` ? "bg-white/7 text-white" : "text-slate-400 hover:bg-white/4 hover:text-slate-100"
                    }`}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/6 text-sm">
                      {s.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.title}</span>
                      <span className="block truncate text-[11px] text-slate-500">{formatRelative(s.updatedAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-white/6 pt-4">
          {subjects.slice(0, 6).map((s) => (
            <span key={s} className="chip">{s}</span>
          ))}
        </div>
      )}

      <div className="border-t border-white/6 pt-3">
        <EngineBadge compact />
      </div>
    </div>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/6 bg-ink-950/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={18} />
          <span className="text-sm font-extrabold tracking-tight text-white">
            Storm<span className="text-gradient">Learn</span>
          </span>
        </Link>
        <button className="btn btn-ghost !px-2.5 !py-2" onClick={() => setOpen(true)} aria-label="Open menu">
          <Icon name="menu" size={18} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute left-0 top-0 h-full w-[19rem] max-w-[86vw] border-r border-white/8 bg-ink-900/98 p-5 shadow-2xl animate-pop">
            <button className="btn btn-quiet absolute right-3 top-3 !px-2 !py-1.5" onClick={() => setOpen(false)} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
            {content}
          </div>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-[17.5rem] shrink-0 border-r border-white/6 bg-ink-900/45 p-5 backdrop-blur-xl lg:block">
        {content}
      </aside>
    </>
  );
}
