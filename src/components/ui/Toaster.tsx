"use client";

import { useToasts } from "@/lib/toast";

const ICONS: Record<string, string> = {
  success: "✓",
  error: "!",
  info: "i",
};

const STYLES: Record<string, string> = {
  success: "border-emerald-400/35 bg-emerald-500/12 text-emerald-100",
  error: "border-rose-400/35 bg-rose-500/12 text-rose-100",
  info: "border-white/12 bg-ink-800/90 text-slate-100",
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] flex w-[min(94vw,26rem)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm shadow-2xl backdrop-blur-xl animate-pop ${STYLES[t.kind]}`}
        >
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/12 text-[11px] font-bold">
            {ICONS[t.kind]}
          </span>
          <span className="leading-snug">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
