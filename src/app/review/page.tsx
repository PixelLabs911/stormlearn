"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell, PageHeader } from "@/components/ui/Shell";
import { Icon } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { gradeCard, GRADE_LABELS, isDue, mastery, type Grade } from "@/lib/srs";
import type { Flashcard, StudySet } from "@/lib/types";
import { formatDue } from "@/lib/utils";

interface QueueItem extends Flashcard {
  setId: string;
  setTitle: string;
  emoji: string;
  color: string;
}

export default function ReviewPage() {
  const { sets, updateSet, ready } = useStore();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [again, setAgain] = useState(0);
  const [started, setStarted] = useState(false);

  const dueBySet = useMemo(
    () =>
      sets
        .map((s) => ({ set: s, due: s.content.flashcards.filter((c) => isDue(c)).length }))
        .filter((x) => x.due > 0)
        .sort((a, b) => b.due - a.due),
    [sets]
  );

  const totalDue = dueBySet.reduce((n, x) => n + x.due, 0);

  const build = useCallback(() => {
    const items: QueueItem[] = [];
    for (const s of sets) {
      for (const c of s.content.flashcards) {
        if (isDue(c)) items.push({ ...c, setId: s.id, setTitle: s.title, emoji: s.emoji, color: s.color });
      }
    }
    // interleave sets so one subject doesn't dominate the session
    const bySet = new Map<string, QueueItem[]>();
    for (const it of items) bySet.set(it.setId, [...(bySet.get(it.setId) || []), it]);
    const buckets = [...bySet.values()];
    const out: QueueItem[] = [];
    let added = true;
    let i = 0;
    while (added) {
      added = false;
      for (const b of buckets) {
        if (i < b.length) {
          out.push(b[i]);
          added = true;
        }
      }
      i++;
    }
    setQueue(out);
    setPos(0);
    setFlipped(false);
    setReviewed(0);
    setAgain(0);
    setStarted(true);
  }, [sets]);

  const current = queue[pos];

  const grade = useCallback(
    (g: Grade) => {
      if (!current || !flipped) return;
      const graded = gradeCard(current, g);
      updateSet(current.setId, (s: StudySet) => ({
        content: { ...s.content, flashcards: s.content.flashcards.map((c) => (c.id === graded.id ? graded : c)) },
        stats: { ...s.stats, cardsStudied: s.stats.cardsStudied + 1 },
      }));
      setReviewed((r) => r + 1);
      if (g === 0) {
        setAgain((a) => a + 1);
        setQueue((q) => [...q, { ...graded, setId: current.setId, setTitle: current.setTitle, emoji: current.emoji, color: current.color }]);
      }
      setFlipped(false);
      setPos((p) => p + 1);
    },
    [current, flipped, updateSet]
  );

  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /input|textarea/i.test(t.tagName)) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) grade((Number(e.key) - 1) as Grade);
      else if (e.key === "ArrowRight") setPos((p) => p + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, flipped, grade]);

  const overallMastery = sets.length
    ? Math.round(sets.reduce((n, s) => n + mastery(s.content.flashcards), 0) / sets.length)
    : 0;

  return (
    <Shell>
      <PageHeader
        title="Review due"
        subtitle="One queue across every study set. Cards come back on a spaced schedule — the better you knew it, the longer it waits."
        right={
          <Link href="/" className="btn btn-ghost">
            <Icon name="arrowLeft" size={15} /> Library
          </Link>
        }
      />

      {!ready ? (
        <div className="panel h-64 animate-pulse bg-white/3" />
      ) : !sets.length ? (
        <div className="panel grid place-items-center px-6 py-20 text-center">
          <Icon name="layers" size={26} className="mb-3 text-slate-600" />
          <h2 className="font-extrabold text-white">No study sets yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            Create a study set first — cards you grade land here on a spaced-repetition schedule.
          </p>
          <Link href="/new" className="btn btn-primary mt-5">
            <Icon name="sparkle" size={15} /> Create a study set
          </Link>
        </div>
      ) : !started ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="panel p-6">
            {totalDue > 0 ? (
              <>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-extrabold leading-none tracking-tight text-white">{totalDue}</span>
                  <span className="pb-2 text-sm text-slate-400">cards due across {dueBySet.length} sets</span>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  {dueBySet.map(({ set, due }) => (
                    <Link
                      key={set.id}
                      href={`/set/${set.id}?tab=flashcards`}
                      className="flex items-center gap-3 rounded-xl border border-white/7 bg-white/2 px-3.5 py-3 transition hover:border-white/16 hover:bg-white/5"
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${set.color} text-lg`}>{set.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-white">{set.title}</span>
                        <span className="block text-[11.5px] text-slate-500">{mastery(set.content.flashcards)}% mastery · {set.content.flashcards.length} cards</span>
                      </span>
                      <span className="chip !border-accent-400/30 !bg-accent-400/10 !text-accent-300">{due} due</span>
                      <Icon name="chevronRight" size={15} className="text-slate-600" />
                    </Link>
                  ))}
                </div>
                <button className="btn btn-primary mt-6 w-full !py-3.5 text-[15px]" onClick={build}>
                  <Icon name="bolt" size={17} /> Start mixed review ({totalDue} cards)
                </button>
              </>
            ) : (
              <div className="grid place-items-center py-10 text-center">
                <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_16px_40px_-14px_rgba(16,185,129,0.9)] animate-float">
                  <Icon name="check" size={26} />
                </span>
                <h2 className="text-lg font-extrabold text-white">You're all caught up</h2>
                <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-400">
                  Nothing is due right now. Overall mastery across your library is {overallMastery}%. Come back when the
                  scheduler brings cards round — or push ahead with new material.
                </p>
                <Link href="/new" className="btn btn-ghost mt-5">
                  <Icon name="plus" size={15} /> Study something new
                </Link>
              </div>
            )}
          </div>

          <aside className="panel p-4">
            <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">How the schedule works</h3>
            <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-slate-400">
              {[
                ["Again", "back in under a minute"],
                ["Hard", "same box, ~10 minutes"],
                ["Good", "one box up, next day"],
                ["Easy", "two boxes up, ~3 days"],
              ].map(([label, when]) => (
                <li key={label} className="flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-white/2 px-3 py-2">
                  <span className="font-semibold text-slate-200">{label}</span>
                  <span className="text-[11px] text-slate-500">{when}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      ) : !current ? (
        <div className="panel grid place-items-center px-6 py-20 text-center">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white animate-float">
            <Icon name="check" size={26} />
          </span>
          <h2 className="text-xl font-extrabold text-white">Queue cleared</h2>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            {reviewed} cards reviewed{again ? `, ${again} pushed back for another pass` : ""}. Overall mastery is now{" "}
            {overallMastery}%.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button className="btn btn-primary" onClick={build} disabled={!totalDue}>
              <Icon name="refresh" size={15} /> {totalDue ? "Keep going" : "Nothing left"}
            </button>
            <Link href="/" className="btn btn-ghost">
              <Icon name="library" size={15} /> Back to library
            </Link>
            <button className="btn btn-quiet" onClick={() => setStarted(false)}>Exit review</button>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex items-center justify-between text-[11.5px] text-slate-500">
            <Link href={`/set/${current.setId}`} className="flex items-center gap-2 hover:text-slate-200">
              <span className={`grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br ${current.color} text-[12px]`}>{current.emoji}</span>
              <span className="max-w-[16rem] truncate font-semibold">{current.setTitle}</span>
            </Link>
            <span>
              {pos + 1} / {queue.length} · {reviewed} reviewed · {formatDue(current.srs.due)}
            </span>
          </div>

          <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/7">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-punch-500 transition-all duration-500" style={{ width: `${(pos / Math.max(1, queue.length)) * 100}%` }} />
          </div>

          <button className="block w-full [perspective:1600px]" onClick={() => setFlipped((f) => !f)}>
            <div
              className="flip-3d relative min-h-[18rem] w-full transition-transform duration-500"
              style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
            >
              <div className="flip-hidden absolute inset-0 grid place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-ink-800 to-ink-900 p-8">
                <p className="text-center text-[1.2rem] font-semibold leading-snug text-white sm:text-[1.4rem]">{current.front}</p>
              </div>
              <div className="flip-hidden flip-rotate absolute inset-0 grid place-items-center rounded-2xl border border-brand-400/25 bg-gradient-to-br from-brand-600/14 via-ink-800 to-punch-500/10 p-8">
                <p className="text-center text-[1.05rem] leading-relaxed text-slate-100 sm:text-[1.2rem]">{current.back}</p>
              </div>
            </div>
          </button>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!flipped ? (
              <button className="btn btn-primary flex-1 !py-3" onClick={() => setFlipped(true)}>
                <Icon name="refresh" size={15} /> Show answer
              </button>
            ) : (
              <div className="grid flex-1 grid-cols-4 gap-2">
                {GRADE_LABELS.map((label, idx) => (
                  <button
                    key={label}
                    onClick={() => grade(idx as Grade)}
                    className={`btn !py-2.5 text-[12.5px] ${idx === 0 ? "btn-danger" : idx === 3 ? "border border-emerald-400/35 bg-emerald-500/14 text-emerald-100" : "btn-ghost"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button className="btn btn-ghost !px-3" onClick={() => setPos((p) => p + 1)} title="Skip">
              <Icon name="chevronRight" size={15} />
            </button>
          </div>
          <p className="mt-3 text-center font-mono text-[11px] text-slate-600">space flip · 1-4 grade · → skip</p>
        </div>
      )}
    </Shell>
  );
}
