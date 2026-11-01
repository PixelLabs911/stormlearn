"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell, PageHeader } from "@/components/ui/Shell";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { dueCount, mastery } from "@/lib/srs";
import { formatRelative } from "@/lib/utils";
import { SAMPLES } from "@/lib/samples";

const SOURCE_ICONS: Record<string, IconName> = {
  pdf: "file",
  docx: "file",
  text: "paste",
  audio: "mic",
  video: "mic",
  youtube: "youtube",
};

export default function LibraryPage() {
  const { sets, subjects, ready } = useStore();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string>("All");
  const [sort, setSort] = useState<"recent" | "title" | "progress">("recent");

  const stats = useMemo(() => {
    const cards = sets.reduce((n, s) => n + s.content.flashcards.length, 0);
    const due = sets.reduce((n, s) => n + dueCount(s.content.flashcards), 0);
    const questions = sets.reduce((n, s) => n + s.content.questions.length, 0);
    const minutes = sets.reduce((n, s) => n + s.stats.minutes, 0);
    const avgMastery = sets.length
      ? Math.round(sets.reduce((n, s) => n + mastery(s.content.flashcards), 0) / sets.length)
      : 0;
    return { cards, due, questions, minutes, avgMastery };
  }, [sets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = sets.filter(
      (s) =>
        (subject === "All" || s.subject === subject) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.subject.toLowerCase().includes(q) ||
          s.content.keyTerms.some((t) => t.term.toLowerCase().includes(q)))
    );
    list = [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "progress") return mastery(b.content.flashcards) - mastery(a.content.flashcards);
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [sets, query, subject, sort]);

  return (
    <Shell>
      <PageHeader
        title="Your library"
        subtitle="Every lecture, PDF and video you feed in becomes notes, flashcards, a quiz, a podcast and a tutor — all searchable from here."
        right={
          <>
            <Link href="/new" className="btn btn-primary">
              <Icon name="sparkle" size={16} />
              Generate study materials
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="layers" label="Study sets" value={String(sets.length)} hint={`${subjects.length} subjects`} />
        <Stat icon="cards" label="Flashcards" value={String(stats.cards)} hint={`${stats.due} due now`} accent={stats.due > 0} />
        <Stat icon="quiz" label="Quiz questions" value={String(stats.questions)} hint="ready to run" />
        <Stat icon="flame" label="Avg. mastery" value={`${stats.avgMastery}%`} hint={stats.minutes ? `${stats.minutes} min of material` : "study to build it up"} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[13rem] flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input !pl-9"
            placeholder="Search sets, subjects or key terms…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto">
          {["All", ...subjects].map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`chip !cursor-pointer transition ${
                subject === s ? "!border-brand-400/45 !bg-brand-500/18 !text-brand-100" : "hover:!bg-white/8"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select className="input !w-auto !py-2 !text-xs" value={sort} onChange={(e) => setSort(e.target.value as any)}>
          <option value="recent">Recently updated</option>
          <option value="title">Title A–Z</option>
          <option value="progress">Mastery</option>
        </select>
      </div>

      {!ready ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="panel h-52 animate-pulse bg-white/3" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        sets.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="panel grid place-items-center px-6 py-16 text-center">
            <Icon name="search" size={26} className="mb-3 text-slate-600" />
            <p className="font-semibold text-slate-200">Nothing matches that search</p>
            <button className="btn btn-quiet mt-2 text-xs" onClick={() => { setQuery(""); setSubject("All"); }}>
              Clear filters
            </button>
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const m = mastery(s.content.flashcards);
            const due = dueCount(s.content.flashcards);
            return (
              <Link
                key={s.id}
                href={`/set/${s.id}`}
                className="panel group relative flex flex-col overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/5"
              >
                <div className={`pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${s.color} opacity-20 blur-2xl transition group-hover:opacity-35`} />
                <div className="mb-3 flex items-start gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${s.color} text-xl shadow-lg`}>
                    {s.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold leading-snug text-white">{s.title}</h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {s.subject} · {formatRelative(s.updatedAt)}
                    </p>
                  </div>
                  <Icon name="chevronRight" size={16} className="mt-1 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
                </div>

                <p className="mb-4 line-clamp-2 text-[13px] leading-relaxed text-slate-400">
                  {s.content.summary.replace(/\*\*/g, "")}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  <span className="chip">
                    <Icon name={(SOURCE_ICONS[s.source.kind] || "file") as IconName} size={12} />
                    {s.source.kind}
                  </span>
                  <span className="chip">
                    <Icon name="notes" size={12} />
                    {s.content.sections.length} sections
                  </span>
                  <span className="chip">
                    <Icon name="cards" size={12} />
                    {s.content.flashcards.length} cards
                  </span>
                  {due > 0 && (
                    <span className="chip !border-accent-400/35 !bg-accent-400/12 !text-accent-300">
                      <Icon name="clock" size={12} />
                      {due} due
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Mastery</span>
                    <span className={m > 60 ? "text-emerald-300" : m > 25 ? "text-accent-300" : "text-slate-400"}>{m}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/7">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${s.color} transition-all duration-700`}
                      style={{ width: `${Math.max(3, m)}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="panel flex items-center gap-3 p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent ? "bg-accent-400/15 text-accent-300" : "bg-white/6 text-brand-300"}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-extrabold leading-none tracking-tight text-white">{value}</span>
        <span className="mt-1 block truncate text-[11.5px] font-semibold text-slate-400">{label}</span>
        <span className="block truncate text-[10.5px] text-slate-600">{hint}</span>
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="panel relative overflow-hidden px-6 py-12 text-center sm:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.14),transparent_65%)]" />
      <div className="relative">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 via-violet-500 to-punch-500 shadow-[0_16px_40px_-14px_rgba(139,92,246,1)] animate-float">
          <Icon name="bolt" size={26} className="text-white" />
        </span>
        <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          Turn anything into a full study kit
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
          Drop in a lecture recording, a PDF, a YouTube link or your own rough notes. StormLearn reads it and hands back
          structured notes, spaced-repetition flashcards, a mixed-format quiz, a two-host study podcast and a tutor that
          answers only from your material.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Link href="/new" className="btn btn-primary">
            <Icon name="sparkle" size={16} />
            Create your first study set
          </Link>
        </div>

        <div className="mt-9 border-t border-white/7 pt-7">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Or start from a sample
          </p>
          <div className="mx-auto grid max-w-3xl gap-2.5 sm:grid-cols-3">
            {SAMPLES.map((s) => (
              <Link
                key={s.id}
                href={`/new?sample=${s.id}`}
                className="panel flex items-center gap-3 p-3 text-left transition hover:-translate-y-0.5 hover:border-brand-400/35 hover:bg-white/6"
              >
                <span className="text-xl">{s.emoji}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-slate-100">{s.title}</span>
                  <span className="block truncate text-[11px] text-slate-500">{s.meta}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
