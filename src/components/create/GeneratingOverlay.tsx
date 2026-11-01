"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

const STEPS: { label: string; icon: IconName; ms: number }[] = [
  { label: "Reading your source material", icon: "eye", ms: 900 },
  { label: "Pulling out key concepts & definitions", icon: "brain", ms: 1200 },
  { label: "Writing structured notes", icon: "notes", ms: 1000 },
  { label: "Building flashcards with spaced repetition", icon: "cards", ms: 900 },
  { label: "Drafting quiz questions & explanations", icon: "quiz", ms: 900 },
  { label: "Scripting your two-host study podcast", icon: "podcast", ms: 800 },
];

export function GeneratingOverlay({
  title,
  engineLabel,
  onCancel,
}: {
  title: string;
  engineLabel: string;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    // Advance through the choreography, then hold on the last step until the
    // real response lands.
    let cancelled = false;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      if (i < STEPS.length - 1) {
        i += 1;
        setStep(i);
        window.setTimeout(tick, STEPS[i].ms);
      }
    };
    const first = window.setTimeout(tick, STEPS[0].ms);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink-950/88 px-5 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 p-7 shadow-2xl animate-pop">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-brand-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-punch-500/20 blur-3xl" />

        <div className="relative">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-500 to-punch-500 animate-bolt">
              <Icon name="bolt" size={21} className="text-white" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-extrabold tracking-tight text-white">Generating study materials…</h2>
              <p className="truncate text-xs text-slate-500">
                {title} · {engineLabel} · {elapsed}s
              </p>
            </div>
          </div>

          <ul className="flex flex-col gap-1.5">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li
                  key={s.label}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-[13px] transition-all duration-300 ${
                    active
                      ? "border-brand-400/35 bg-brand-500/10 text-white"
                      : done
                        ? "border-white/6 bg-white/2 text-slate-400"
                        : "border-transparent text-slate-600 opacity-55"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
                      done ? "bg-emerald-500/18 text-emerald-300" : active ? "bg-brand-500/22 text-brand-200" : "bg-white/5 text-slate-600"
                    }`}
                  >
                    {done ? <Icon name="check" size={13} /> : <Icon name={s.icon} size={13} />}
                  </span>
                  <span className="flex-1 font-medium">{s.label}</span>
                  {active && (
                    <span className="flex items-end gap-[2px]" aria-hidden>
                      {[0, 1, 2].map((b) => (
                        <span
                          key={b}
                          className="bar w-[3px] rounded-full bg-brand-300"
                          style={{ height: 13, animationDelay: `${b * 0.14}s`, animationDuration: "0.85s" }}
                        />
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/7">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 via-violet-500 to-punch-500 transition-all duration-700 ease-out"
              style={{ width: `${Math.min(96, 12 + step * 15)}%` }}
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="shimmer-text animate-shimmer text-[12px] font-semibold">
              Building notes, flashcards, a quiz, a podcast and a tutor from one source…
            </p>
            {onCancel && (
              <button className="btn btn-quiet !px-2.5 !py-1.5 text-xs" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
