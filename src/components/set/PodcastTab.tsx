"use client";

import { useEffect, useMemo, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { usePodcast } from "@/lib/usePodcast";
import type { StudySet } from "@/lib/types";
import { copyText, download, words } from "@/lib/utils";

const RATES = [0.85, 1, 1.25, 1.5, 2];

export function PodcastTab({ set }: { set: StudySet }) {
  const { updateSet } = useStore();
  const lines = set.content.podcast;
  const p = usePodcast(lines);
  const activeRef = useRef<HTMLLIElement>(null);
  const countedRef = useRef(false);

  const durationMin = useMemo(() => {
    const w = lines.reduce((n, l) => n + words(l.text), 0);
    return Math.max(1, Math.round((w / 155) / p.rate));
  }, [lines, p.rate]);

  useEffect(() => {
    if (p.playing && !countedRef.current) {
      countedRef.current = true;
      updateSet(set.id, (s) => ({ stats: { ...s.stats, podcastPlays: s.stats.podcastPlays + 1 } }));
    }
    if (!p.playing && p.index === 0) countedRef.current = false;
  }, [p.playing, p.index, set.id, updateSet]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [p.index, p.playing]);

  if (!lines.length) {
    return (
      <div className="panel grid place-items-center px-6 py-16 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/6 p-3.5 text-slate-400">
          <Icon name="podcast" size={24} />
        </span>
        <h2 className="text-lg font-extrabold text-white">No podcast script yet</h2>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-400">
          Hit <span className="font-semibold text-slate-200">Regenerate</span> at the top of this study set and a
          two-host study episode will be scripted from your source — then it plays aloud right here.
        </p>
      </div>
    );
  }

  const script = lines
    .map((l) => `${l.speaker === "A" ? p.speakerNames.A : p.speakerNames.B}: ${l.text}`)
    .join("\n\n");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* player */}
        <div className="panel relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-punch-500/16 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-brand-600/16 blur-3xl" />

          <div className="relative flex flex-wrap items-center gap-4">
            <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${set.color} text-3xl shadow-xl ${p.playing ? "animate-float" : ""}`}>
              🎧
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-brand-300">Study podcast</p>
              <h2 className="truncate text-lg font-extrabold tracking-tight text-white">{set.content.podcastTitle}</h2>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {lines.length} lines · ~{durationMin} min · two hosts · played {set.stats.podcastPlays}×
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost !px-2.5" onClick={() => p.seek(Math.max(0, p.index - 1))} title="Previous line" disabled={p.index === 0}>
                <Icon name="chevronLeft" size={15} />
              </button>
              <button
                className="btn btn-primary !rounded-full !px-5 !py-3"
                onClick={() => {
                  if (p.playing) p.pause();
                  else if (p.paused) p.resume();
                  else p.play(p.finished ? 0 : p.index);
                }}
                disabled={!p.supported}
              >
                <Icon name={p.playing ? "pause" : "play"} size={16} />
                {p.playing ? "Pause" : p.paused ? "Resume" : p.index > 0 ? "Resume" : "Play"}
              </button>
              <button className="btn btn-ghost !px-2.5" onClick={() => p.seek(Math.min(lines.length - 1, p.index + 1))} title="Next line" disabled={p.index >= lines.length - 1}>
                <Icon name="chevronRight" size={15} />
              </button>
              <button className="btn btn-ghost !px-2.5" onClick={p.stop} title="Stop">
                <Icon name="stop" size={13} />
              </button>
            </div>
          </div>

          {/* waveform */}
          <div className="relative mt-5 flex h-14 items-end justify-center gap-[3px]" aria-hidden>
            {Array.from({ length: 64 }).map((_, i) => {
              const near = Math.abs(i - (p.index / Math.max(1, lines.length)) * 64) < 6;
              return (
                <span
                  key={i}
                  className={`w-[4px] rounded-full ${p.playing ? "bar" : ""} ${near ? "bg-gradient-to-t from-punch-500 to-accent-300" : "bg-gradient-to-t from-brand-600/70 to-brand-400/40"}`}
                  style={{
                    height: `${14 + ((i * 53) % 82)}%`,
                    animationDelay: `${(i % 11) * 0.07}s`,
                    animationDuration: `${0.7 + ((i % 6) * 0.11)}s`,
                    opacity: p.playing ? 1 : 0.35,
                  }}
                />
              );
            })}
          </div>

          <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Icon name="volume" size={14} className="text-slate-500" />
              {RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => p.setRate(r)}
                  className={`rounded-lg px-2 py-1 text-[11.5px] font-bold transition ${
                    p.rate === r ? "bg-brand-500/22 text-white" : "text-slate-500 hover:bg-white/6 hover:text-slate-200"
                  }`}
                >
                  {r}×
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button className="btn btn-quiet !px-2 !py-1.5 text-[11.5px]" onClick={() => copyText(script).then((ok) => toast(ok ? "Script copied" : "Copy failed", ok ? "success" : "error"))}>
                <Icon name="copy" size={13} /> Script
              </button>
              <button
                className="btn btn-quiet !px-2 !py-1.5 text-[11.5px]"
                onClick={() => {
                  download(`${set.content.podcastTitle.replace(/[^\w\- ]+/g, "").trim() || "podcast"}.txt`, `${set.content.podcastTitle}\n\n${script}\n`, "text/plain");
                  toast("Script downloaded", "success");
                }}
              >
                <Icon name="download" size={13} /> Download
              </button>
            </div>
          </div>

          {!p.supported && (
            <p className="relative mt-4 flex items-start gap-2 rounded-xl border border-accent-400/25 bg-accent-400/8 px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-100/90">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              This browser has no speech synthesis, so the episode can't be read aloud. The full script is still
              available to copy or download.
            </p>
          )}
        </div>

        {/* transcript */}
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/7 px-4 py-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Transcript</h3>
            <span className="text-[11px] text-slate-600">
              line {Math.min(p.index + 1, lines.length)} / {lines.length} · click any line to jump there
            </span>
          </div>
          <ul className="max-h-[30rem] overflow-y-auto p-4">
            {lines.map((l, idx) => {
              const active = idx === p.index;
              const A = l.speaker === "A";
              return (
                <li
                  key={idx}
                  ref={active ? activeRef : undefined}
                  className={`mb-2 flex gap-3 rounded-xl px-3 py-2.5 transition cursor-pointer ${
                    active
                      ? "border border-brand-400/35 bg-brand-500/10"
                      : idx < p.index
                        ? "opacity-55 hover:opacity-100"
                        : "hover:bg-white/4"
                  }`}
                  onClick={() => (p.playing ? p.seek(idx) : p.seek(idx))}
                >
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold ${
                      A ? "bg-gradient-to-br from-brand-500 to-violet-500 text-white" : "bg-gradient-to-br from-accent-400 to-orange-500 text-ink-900"
                    }`}
                  >
                    {A ? "N" : "M"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {A ? p.speakerNames.A : p.speakerNames.B}
                    </p>
                    <p className={`text-[13.5px] leading-relaxed ${active ? "text-white" : "text-slate-300"}`}>{l.text}</p>
                  </div>
                  {active && p.playing && (
                    <span className="ml-auto flex items-end gap-[2px] self-center" aria-hidden>
                      {[0, 1, 2].map((b) => (
                        <span key={b} className="bar w-[3px] rounded-full bg-brand-300" style={{ height: 14, animationDelay: `${b * 0.13}s` }} />
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <div className="panel p-4">
          <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">The hosts</h3>
          <div className="flex flex-col gap-2.5">
            <Host name={p.speakerNames.A} role="Asks, quizzes, keeps you honest" grad="from-brand-500 to-violet-500" letter="N" />
            <Host name={p.speakerNames.B} role="Explains, connects ideas, gives the memory tricks" grad="from-accent-400 to-orange-500" letter="M" dark />
          </div>
        </div>

        <div className="panel p-4">
          <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">How to use it</h3>
          <ol className="flex flex-col gap-2 text-[12px] leading-relaxed text-slate-400">
            {[
              "Listen once at 1.25× while you walk or commute — no notes needed.",
              "Listen again after reading the notes; the ideas land differently.",
              "Pause on any line you can't explain back, and turn it into a flashcard.",
            ].map((t, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-px shrink-0 font-mono text-[10.5px] font-bold text-brand-300">{idx + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel p-4 text-[12px] leading-relaxed text-slate-500">
          <Icon name="info" size={14} className="mb-1.5 text-slate-600" />
          Audio is synthesised in your browser with two distinct voices — nothing is uploaded. Chrome, Edge and Safari
          all ship usable voices.
        </div>
      </aside>
    </div>
  );
}

function Host({ name, role, grad, letter, dark }: { name: string; role: string; grad: string; letter: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${grad} text-[12px] font-extrabold ${dark ? "text-ink-900" : "text-white"}`}>
        {letter}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-white">{name}</span>
        <span className="block truncate text-[11px] text-slate-500">{role}</span>
      </span>
    </div>
  );
}
