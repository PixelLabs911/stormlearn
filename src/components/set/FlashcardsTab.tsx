"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { buildQueue, dueCount, freshCard, gradeCard, GRADE_LABELS, isDue, mastery, type Grade } from "@/lib/srs";
import type { Flashcard, StudySet } from "@/lib/types";
import { formatDue } from "@/lib/utils";

export function FlashcardsTab({ set }: { set: StudySet }) {
  const { updateSet, settings, llmActive } = useStore();
  const cards = set.content.flashcards;

  const [view, setView] = useState<"session" | "deck">(cards.length ? "session" : "deck");
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, easy: 0 });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);

  const due = dueCount(cards);
  const m = mastery(cards);

  const startSession = useCallback(
    (maxNew = 12) => {
      const q = buildQueue(cards, maxNew);
      if (!q.length) {
        setDone(true);
        setQueue([]);
        return;
      }
      setQueue(q);
      setPos(0);
      setFlipped(false);
      setShowHint(false);
      setDone(false);
      setSessionStats({ reviewed: 0, again: 0, easy: 0 });
      startedRef.current = true;
    },
    [cards]
  );

  useEffect(() => {
    if (cards.length && !startedRef.current) startSession();
  }, [cards.length, startSession]);

  const current = queue[pos];

  const commit = useCallback(
    (id: string, graded: Flashcard, requeue: boolean) => {
      updateSet(set.id, (s) => {
        const flashcards = s.content.flashcards.map((c) => (c.id === id ? graded : c));
        return {
          content: { ...s.content, flashcards },
          stats: { ...s.stats, cardsStudied: s.stats.cardsStudied + 1 },
        };
      });
      if (requeue) setQueue((q) => [...q, graded]);
    },
    [set.id, updateSet]
  );

  const grade = useCallback(
    (g: Grade) => {
      if (!current || !flipped) return;
      const graded = gradeCard(current, g);
      commit(current.id, graded, g === 0);
      setSessionStats((st) => ({
        reviewed: st.reviewed + 1,
        again: st.again + (g === 0 ? 1 : 0),
        easy: st.easy + (g === 3 ? 1 : 0),
      }));
      setFlipped(false);
      setShowHint(false);
      if (pos + 1 >= queue.length + (g === 0 ? 1 : 0)) {
        setDone(true);
      } else {
        setPos((p) => p + 1);
      }
    },
    [commit, current, flipped, pos, queue.length]
  );

  const next = useCallback(() => {
    setFlipped(false);
    setShowHint(false);
    if (pos + 1 >= queue.length) setDone(true);
    else setPos((p) => p + 1);
  }, [pos, queue.length]);

  const prev = useCallback(() => {
    setFlipped(false);
    setPos((p) => Math.max(0, p - 1));
  }, []);

  // keyboard control
  useEffect(() => {
    if (view !== "session" || done || !current) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && /input|textarea/i.test(target.tagName)) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key.toLowerCase() === "h") setShowHint((h) => !h);
      else if (flipped && ["1", "2", "3", "4"].includes(e.key)) grade((Number(e.key) - 1) as Grade);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, done, current, flipped, grade, next, prev]);

  const patchCard = (id: string, patch: Partial<Flashcard>) => {
    updateSet(set.id, (s) => ({
      content: { ...s.content, flashcards: s.content.flashcards.map((c) => (c.id === id ? { ...c, ...patch } : c)) },
    }));
  };

  const deleteCard = (id: string) => {
    updateSet(set.id, (s) => ({
      content: { ...s.content, flashcards: s.content.flashcards.filter((c) => c.id !== id) },
    }));
    toast("Card deleted", "info");
  };

  const addCard = (front: string, back: string) => {
    const card = freshCard(front.trim(), back.trim());
    updateSet(set.id, (s) => ({ content: { ...s.content, flashcards: [card, ...s.content.flashcards] } }));
    setQueue((q) => [card, ...q]);
    toast("Card added", "success");
  };

  const generateMore = async (n = 6) => {
    if (!set.text) {
      toast("This set has no source text to generate from.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: set.title,
          text: set.text,
          source: set.source,
          options: { cards: n + cards.length, questions: 1, difficulty: "mixed" },
          settings: llmActive ? settings : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Generation failed.");
      const existing = new Set(cards.map((c) => c.front.toLowerCase()));
      const fresh = (data.content.flashcards as Flashcard[]).filter((c) => !existing.has(c.front.toLowerCase())).slice(0, n);
      if (!fresh.length) {
        toast("No new cards — the source is already covered.", "info");
        return;
      }
      updateSet(set.id, (s) => ({ content: { ...s.content, flashcards: [...s.content.flashcards, ...fresh] } }));
      toast(`Added ${fresh.length} new cards`, "success");
    } catch (err: any) {
      toast(err?.message || "Generation failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!cards.length) {
    return (
      <EmptyDeck busy={busy} onGenerate={() => generateMore(10)} onAdd={addCard} hasSource={!!set.text} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button className={`tab ${view === "session" ? "tab-active" : ""}`} onClick={() => setView("session")}>
            <Icon name="flame" size={14} /> Study session
          </button>
          <button className={`tab ${view === "deck" ? "tab-active" : ""}`} onClick={() => setView("deck")}>
            <Icon name="layers" size={14} /> Deck ({cards.length})
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="chip"><Icon name="flame" size={11} /> {m}% mastery</span>
          <span className={`chip ${due ? "!border-accent-400/35 !bg-accent-400/10 !text-accent-300" : ""}`}>
            <Icon name="clock" size={11} /> {due} due
          </span>
          <span className="chip"><Icon name="check" size={11} /> {set.stats.cardsStudied} reviewed</span>
          <button className="btn btn-ghost !px-2.5 !py-1.5 text-[11.5px]" onClick={() => generateMore(6)} disabled={busy}>
            <Icon name="sparkle" size={13} /> {busy ? "Generating…" : "Add AI cards"}
          </button>
        </div>
      </div>

      {view === "session" ? (
        done ? (
          <SessionDone stats={sessionStats} onRestart={() => startSession(8)} onDeck={() => setView("deck")} due={due} />
        ) : current ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div>
              <div className="mb-2 flex items-center justify-between text-[11.5px] text-slate-500">
                <span>
                  Card {pos + 1} of {queue.length}
                  {sessionStats.reviewed > 0 && ` · ${sessionStats.reviewed} reviewed`}
                </span>
                <span className="font-mono">space flip · ←→ move · 1-4 grade · H hint</span>
              </div>

              <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/7">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-punch-500 transition-all duration-500"
                  style={{ width: `${(pos / Math.max(1, queue.length)) * 100}%` }}
                />
              </div>

              <button
                className="block w-full [perspective:1600px]"
                onClick={() => setFlipped((f) => !f)}
                aria-label="Flip card"
              >
                <div
                  className="flip-3d relative min-h-[19rem] w-full transition-transform duration-500 sm:min-h-[21rem]"
                  style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                >
                  <CardFace side="front" card={current} showHint={showHint} />
                  <CardFace side="back" card={current} />
                </div>
              </button>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button className="btn btn-ghost !px-2.5" onClick={prev} disabled={pos === 0} title="Previous">
                  <Icon name="chevronLeft" size={15} />
                </button>
                {!flipped ? (
                  <>
                    <button className="btn btn-primary flex-1 !py-3" onClick={() => setFlipped(true)}>
                      <Icon name="refresh" size={15} /> Show answer
                    </button>
                    {current.hint && (
                      <button className="btn btn-ghost" onClick={() => setShowHint((h) => !h)} title="Hint (H)">
                        <Icon name="info" size={15} /> Hint
                      </button>
                    )}
                  </>
                ) : (
                  <div className="grid flex-1 grid-cols-4 gap-2">
                    {GRADE_LABELS.map((label, i) => (
                      <button
                        key={label}
                        onClick={() => grade(i as Grade)}
                        className={`btn !py-2.5 text-[12.5px] ${
                          i === 0
                            ? "btn-danger"
                            : i === 3
                              ? "border border-emerald-400/35 bg-emerald-500/14 text-emerald-100 hover:bg-emerald-500/22"
                              : "btn-ghost"
                        }`}
                        title={`Grade ${label} (${i + 1})`}
                      >
                        <span className="flex flex-col items-center gap-0.5">
                          <span>{label}</span>
                          <span className="text-[10px] font-normal opacity-65">
                            {i === 0 ? "<1m" : i === 1 ? "10m" : i === 2 ? "1d" : "3d"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button className="btn btn-ghost !px-2.5" onClick={next} title="Skip">
                  <Icon name="chevronRight" size={15} />
                </button>
              </div>
            </div>

            <aside className="flex flex-col gap-3">
              <div className="panel p-4">
                <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Queue</h3>
                <div className="flex flex-col gap-1.5 text-[12px] text-slate-400">
                  <Row label="Remaining" value={Math.max(0, queue.length - pos - 1)} />
                  <Row label="Reviewed" value={sessionStats.reviewed} />
                  <Row label="Lapsed" value={sessionStats.again} tone="rose" />
                  <Row label="Easy" value={sessionStats.easy} tone="emerald" />
                </div>
              </div>
              <div className="panel p-4">
                <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Memory boxes</h3>
                <BoxLadder cards={cards} />
              </div>
              <button className="btn btn-ghost w-full" onClick={() => setView("deck")}>
                <Icon name="layers" size={14} /> Manage deck
              </button>
            </aside>
          </div>
        ) : (
          <SessionDone stats={sessionStats} onRestart={() => startSession(8)} onDeck={() => setView("deck")} due={due} />
        )
      ) : (
        <DeckView cards={cards} onPatch={patchCard} onDelete={deleteCard} onAdd={addCard} />
      )}
    </div>
  );
}

function CardFace({ side, card, showHint }: { side: "front" | "back"; card: Flashcard; showHint?: boolean }) {
  const isFront = side === "front";
  return (
    <div
      className={`flip-hidden absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl border p-6 sm:p-8 ${
        isFront
          ? "border-white/10 bg-gradient-to-br from-ink-800 to-ink-900"
          : "border-brand-400/25 bg-gradient-to-br from-brand-600/14 via-ink-800 to-punch-500/10 flip-rotate"
      }`}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-500/12 blur-3xl" />
      <div className="flex items-center justify-between">
        <span className={`chip ${isFront ? "" : "!border-brand-400/30 !bg-brand-500/15 !text-brand-100"}`}>
          <Icon name={isFront ? "quiz" : "check"} size={11} />
          {isFront ? "Question" : "Answer"}
        </span>
        <span className="flex items-center gap-1.5">
          {card.tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {t}
            </span>
          ))}
          <span className="font-mono text-[10px] text-slate-600">box {card.srs.box}</span>
        </span>
      </div>

      <p className={`my-6 text-center leading-snug ${isFront ? "text-[1.15rem] font-semibold text-white sm:text-[1.35rem]" : "text-[1.02rem] text-slate-100 sm:text-[1.15rem]"}`}>
        {isFront ? card.front : card.back}
      </p>

      <div className="flex items-center justify-between text-[11.5px] text-slate-500">
        <span>
          {isFront
            ? card.srs.reps
              ? `Reviewed ${card.srs.reps}× · ${formatDue(card.srs.due)}`
              : "New card"
            : card.srs.lapses
              ? `${card.srs.lapses} lapse${card.srs.lapses > 1 ? "s" : ""}`
              : formatDue(card.srs.due)}
        </span>
        <span className="hidden sm:inline">{isFront ? "Click or press space to flip" : "How well did you know it?"}</span>
      </div>

      {isFront && showHint && card.hint && (
        <div className="mt-3 rounded-xl border border-accent-400/25 bg-accent-400/8 px-3.5 py-2.5 text-[12.5px] text-amber-100/90 animate-pop">
          <span className="font-bold">Hint · </span>
          {card.hint}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone?: "rose" | "emerald" }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={`font-mono font-bold ${tone === "rose" ? "text-rose-300" : tone === "emerald" ? "text-emerald-300" : "text-slate-200"}`}>
        {value}
      </span>
    </div>
  );
}

function BoxLadder({ cards }: { cards: Flashcard[] }) {
  const boxes = [1, 2, 3, 4, 5].map((b) => ({ box: b, n: cards.filter((c) => c.srs.box === b).length }));
  const max = Math.max(1, ...boxes.map((b) => b.n));
  return (
    <div className="flex items-end justify-between gap-1.5">
      {boxes.map((b) => (
        <div key={b.box} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="font-mono text-[10px] text-slate-500">{b.n}</span>
          <div className="flex h-16 w-full items-end overflow-hidden rounded-md bg-white/5">
            <div
              className="w-full rounded-md bg-gradient-to-t from-brand-600 to-punch-400 transition-all duration-700"
              style={{ height: `${(b.n / max) * 100}%`, opacity: b.n ? 1 : 0.15 }}
            />
          </div>
          <span className="text-[10px] font-semibold text-slate-600">{b.box}</span>
        </div>
      ))}
    </div>
  );
}

function SessionDone({
  stats,
  onRestart,
  onDeck,
  due,
}: {
  stats: { reviewed: number; again: number; easy: number };
  onRestart: () => void;
  onDeck: () => void;
  due: number;
}) {
  return (
    <div className="panel grid place-items-center px-6 py-16 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_16px_40px_-14px_rgba(16,185,129,0.9)] animate-float">
        <Icon name="check" size={26} />
      </span>
      <h2 className="text-xl font-extrabold tracking-tight text-white">Session complete</h2>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        {stats.reviewed > 0
          ? `You reviewed ${stats.reviewed} card${stats.reviewed === 1 ? "" : "s"} — ${stats.easy} easy, ${stats.again} need another pass.`
          : "Nothing was due. Come back later or study more new cards."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button className="btn btn-primary" onClick={onRestart}>
          <Icon name="refresh" size={15} /> Study another round
        </button>
        <button className="btn btn-ghost" onClick={onDeck}>
          <Icon name="layers" size={15} /> Manage deck
        </button>
      </div>
      {due > 0 && <p className="mt-4 text-[11.5px] text-accent-300">{due} more cards are due right now</p>}
    </div>
  );
}

function EmptyDeck({
  onGenerate,
  onAdd,
  busy,
  hasSource,
}: {
  onGenerate: () => void;
  onAdd: (f: string, b: string) => void;
  busy: boolean;
  hasSource: boolean;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel grid place-items-center px-6 py-14 text-center">
        <span className="mb-4 grid h-13 w-13 place-items-center rounded-2xl bg-white/6 p-3.5 text-slate-400">
          <Icon name="cards" size={24} />
        </span>
        <h2 className="text-lg font-extrabold text-white">No flashcards yet</h2>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-400">
          {hasSource
            ? "Generate a deck from this study set's source material, or write your own cards below."
            : "This set has no source text. Add some in the Source tab, then generate a deck — or write cards manually."}
        </p>
        <button className="btn btn-primary mt-5" onClick={onGenerate} disabled={busy || !hasSource}>
          <Icon name="sparkle" size={15} /> {busy ? "Generating…" : "Generate 10 cards"}
        </button>
      </div>
      <div className="panel p-5">
        <h3 className="mb-3 font-bold text-white">Add a card</h3>
        <textarea className="input mb-2 resize-y" rows={2} placeholder="Front — the question or prompt" value={front} onChange={(e) => setFront(e.target.value)} />
        <textarea className="input mb-3 resize-y" rows={3} placeholder="Back — the answer" value={back} onChange={(e) => setBack(e.target.value)} />
        <button
          className="btn btn-ghost w-full"
          disabled={!front.trim() || !back.trim()}
          onClick={() => {
            onAdd(front, back);
            setFront("");
            setBack("");
          }}
        >
          <Icon name="plus" size={15} /> Add card
        </button>
      </div>
    </div>
  );
}

function DeckView({
  cards,
  onPatch,
  onDelete,
  onAdd,
}: {
  cards: Flashcard[];
  onPatch: (id: string, patch: Partial<Flashcard>) => void;
  onDelete: (id: string) => void;
  onAdd: (front: string, back: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "due" | "new" | "learned">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [adding, setAdding] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (q && !`${c.front} ${c.back} ${c.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      if (filter === "due") return isDue(c) && c.srs.reps > 0;
      if (filter === "new") return c.srs.reps === 0;
      if (filter === "learned") return c.srs.box >= 4;
      return true;
    });
  }, [cards, query, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input !pl-9 !py-2 !text-[13px]" placeholder="Search cards…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "due", "new", "learned"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`chip !cursor-pointer capitalize ${filter === f ? "!border-brand-400/45 !bg-brand-500/18 !text-brand-100" : "hover:!bg-white/8"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost !py-2 text-[12.5px]" onClick={() => setAdding((a) => !a)}>
          <Icon name="plus" size={14} /> Card
        </button>
      </div>

      {adding && (
        <div className="panel grid gap-2 p-4 sm:grid-cols-[1fr_1fr_auto] animate-pop">
          <input className="input" placeholder="Front" value={front} onChange={(e) => setFront(e.target.value)} />
          <input className="input" placeholder="Back" value={back} onChange={(e) => setBack(e.target.value)} />
          <button
            className="btn btn-primary"
            disabled={!front.trim() || !back.trim()}
            onClick={() => {
              onAdd(front, back);
              setFront("");
              setBack("");
            }}
          >
            Add
          </button>
        </div>
      )}

      <div className="grid gap-2.5 md:grid-cols-2">
        {list.map((c) =>
          editingId === c.id ? (
            <div key={c.id} className="panel grid gap-2 p-3.5 animate-pop">
              <textarea className="input resize-y !text-[13px]" rows={2} value={front} onChange={(e) => setFront(e.target.value)} />
              <textarea className="input resize-y !text-[13px]" rows={3} value={back} onChange={(e) => setBack(e.target.value)} />
              <div className="flex gap-2">
                <button
                  className="btn btn-primary flex-1 !py-1.5 text-[12.5px]"
                  onClick={() => {
                    onPatch(c.id, { front: front.trim(), back: back.trim() });
                    setEditingId(null);
                    toast("Card updated", "success");
                  }}
                  disabled={!front.trim() || !back.trim()}
                >
                  Save
                </button>
                <button className="btn btn-ghost !py-1.5 text-[12.5px]" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={c.id} className="panel group flex flex-col gap-2 p-3.5 transition hover:border-white/14">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13.5px] font-semibold leading-snug text-white">{c.front}</p>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    className="btn btn-quiet !px-1.5 !py-1"
                    title="Edit"
                    onClick={() => {
                      setEditingId(c.id);
                      setFront(c.front);
                      setBack(c.back);
                    }}
                  >
                    <Icon name="edit" size={13} />
                  </button>
                  <button className="btn btn-quiet !px-1.5 !py-1 hover:!text-rose-300" title="Delete" onClick={() => onDelete(c.id)}>
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
              <p className="text-[12.5px] leading-relaxed text-slate-400">{c.back}</p>
              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                <span className={`chip !py-0.5 !text-[10px] ${isDue(c) ? "!border-accent-400/30 !text-accent-300" : ""}`}>
                  box {c.srs.box} · {c.srs.reps ? formatDue(c.srs.due) : "new"}
                </span>
                {c.tags.slice(0, 3).map((t) => (
                  <span key={t} className="chip !py-0.5 !text-[10px]">{t}</span>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {!list.length && (
        <div className="panel grid place-items-center px-6 py-12 text-center text-sm text-slate-500">
          No cards match “{query || filter}”.
        </div>
      )}
    </div>
  );
}

