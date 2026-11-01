"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { NotesTab } from "@/components/set/NotesTab";
import { FlashcardsTab } from "@/components/set/FlashcardsTab";
import { QuizTab } from "@/components/set/QuizTab";
import { ChatTab } from "@/components/set/ChatTab";
import { PodcastTab } from "@/components/set/PodcastTab";
import { SourceTab } from "@/components/set/SourceTab";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { dueCount, mastery } from "@/lib/srs";
import { PROVIDER_LABELS, type StudySet } from "@/lib/types";
import { download, formatRelative, words } from "@/lib/utils";

export type TabId = "notes" | "flashcards" | "quiz" | "chat" | "podcast" | "source";

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: "notes", label: "Notes", icon: "notes" },
  { id: "flashcards", label: "Flashcards", icon: "cards" },
  { id: "quiz", label: "Quiz", icon: "quiz" },
  { id: "chat", label: "Tutor", icon: "chat" },
  { id: "podcast", label: "Podcast", icon: "podcast" },
  { id: "source", label: "Source", icon: "source" },
];

function WorkspaceInner({ set }: { set: StudySet }) {
  const router = useRouter();
  const params = useSearchParams();
  const { updateSet, removeSet, settings, llmActive } = useStore();

  const initial = (params.get("tab") as TabId) || "notes";
  const [tab, setTab] = useState<TabId>(TABS.some((t) => t.id === initial) ? initial : "notes");
  const [busy, setBusy] = useState(false);
  const [showRegen, setShowRegen] = useState(false);

  const m = mastery(set.content.flashcards);
  const due = dueCount(set.content.flashcards);

  const regenerate = useCallback(
    async (opts: { cards?: number; questions?: number; difficulty?: string } = {}) => {
      setBusy(true);
      setShowRegen(false);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: set.title,
            text: set.text,
            source: set.source,
            options: {
              cards: opts.cards ?? set.content.flashcards.length ?? 14,
              questions: opts.questions ?? 10,
              difficulty: opts.difficulty ?? "mixed",
              includePodcast: true,
            },
            settings: llmActive ? settings : undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Regeneration failed.");

        // keep spaced-repetition progress for cards that survived regeneration
        const byFront = new Map(set.content.flashcards.map((c) => [c.front.toLowerCase(), c.srs]));
        const merged = data.content.flashcards.map((c: any) => {
          const prev = byFront.get(c.front.toLowerCase());
          return prev ? { ...c, srs: prev } : c;
        });

        updateSet(set.id, (s) => ({
          content: { ...data.content, flashcards: merged },
          engine: data.engine,
          model: data.model,
          stats: { ...s.stats },
        }));
        data.warnings?.forEach((w: string) => toast(w, "info"));
        toast("Study materials regenerated", "success");
      } catch (err: any) {
        toast(err?.message || "Regeneration failed.", "error");
      } finally {
        setBusy(false);
      }
    },
    [llmActive, set.content.flashcards, set.id, set.source, set.text, set.title, settings, updateSet]
  );

  const exportMarkdown = useCallback(() => {
    const md = [
      set.content.notesMarkdown,
      "",
      "## Flashcards",
      ...set.content.flashcards.map((c, i) => `${i + 1}. **${c.front}**\n   - ${c.back}`),
      "",
      "## Quiz",
      ...set.content.questions.map((q, i) =>
        q.type === "mc"
          ? `${i + 1}. ${q.prompt}\n${(q.options || []).map((o, oi) => `   - ${oi === q.answerIndex ? "(✓)" : "   "} ${o}`).join("\n")}\n   - Explanation: ${q.explanation}`
          : `${i + 1}. [${q.type}] ${q.prompt}\n   - Answer: ${q.answer}\n   - Explanation: ${q.explanation}`
      ),
      "",
      "## Podcast script",
      ...set.content.podcast.map((l) => `**${l.speaker === "A" ? "Nova" : "Miles"}:** ${l.text}`),
      "",
      "## Source material",
      set.text,
    ].join("\n");
    download(`${set.title.replace(/[^\w\- ]+/g, "").trim() || "study-set"}.md`, md, "text/markdown");
    toast("Exported as Markdown", "success");
  }, [set]);

  const exportJson = useCallback(() => {
    download(`${set.title.replace(/[^\w\- ]+/g, "").trim() || "study-set"}.json`, JSON.stringify(set, null, 2), "application/json");
    toast("Exported as JSON", "success");
  }, [set]);

  const counts = useMemo(
    () => ({
      notes: set.content.sections.length,
      flashcards: set.content.flashcards.length,
      quiz: set.content.questions.length,
      chat: set.content.keyTerms.length,
      podcast: set.content.podcast.length,
      source: set.text ? words(set.text) : 0,
    }),
    [set]
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <Link href="/" className="mt-1.5 hidden shrink-0 text-slate-500 transition hover:text-slate-200 sm:block" title="Back to library">
            <Icon name="arrowLeft" size={17} />
          </Link>
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${set.color} text-2xl shadow-lg`}>
            {set.emoji}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[1.35rem] font-extrabold leading-tight tracking-tight text-white sm:text-[1.6rem]">
              {set.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-slate-500">
              <span className="chip !py-0.5">{set.subject}</span>
              <span>·</span>
              <span>{set.source.kind}{set.source.fileName ? ` · ${set.source.fileName}` : ""}</span>
              <span>·</span>
              <span>{words(set.text)} words</span>
              <span>·</span>
              <span>updated {formatRelative(set.updatedAt)}</span>
              <span>·</span>
              <span className={set.engine === "llm" ? "text-emerald-300" : "text-accent-300"}>
                {set.engine === "llm" ? `AI · ${set.model || PROVIDER_LABELS[settings.provider]}` : "demo engine"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-ghost" onClick={() => setShowRegen(true)} disabled={busy || !set.text}>
            {busy ? <Spinner /> : <Icon name="refresh" size={15} />}
            {busy ? "Working…" : "Regenerate"}
          </button>
          <ExportMenu onMarkdown={exportMarkdown} onJson={exportJson} />
          <button
            className="btn btn-danger !px-2.5"
            title="Delete study set"
            onClick={() => {
              if (!window.confirm(`Delete “${set.title}” and all its study materials?`)) return;
              removeSet(set.id);
              toast("Study set deleted", "info");
              router.push("/");
            }}
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>

      {/* progress strip */}
      <div className="panel mb-4 grid grid-cols-2 gap-3 p-3.5 sm:grid-cols-4">
        <MiniStat label="Mastery" value={`${m}%`} bar={m} icon="flame" />
        <MiniStat label="Cards due" value={String(due)} icon="clock" tone={due > 0 ? "accent" : "muted"} />
        <MiniStat label="Quizzes taken" value={String(set.stats.quizzesTaken)} icon="quiz" sub={`best ${set.stats.bestScore || 0}%`} />
        <MiniStat label="Study time" value={`${set.stats.minutes}m`} icon="target" sub={`${set.stats.cardsStudied} cards reviewed`} />
      </div>

      {/* tabs */}
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-white/7 px-1 pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab relative ${tab === t.id ? "tab-active" : ""}`}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
            <span className="ml-0.5 rounded bg-white/8 px-1.5 py-px text-[10px] font-bold text-slate-400">
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {/* content */}
      <div key={tab} className="animate-rise">
        {tab === "notes" && <NotesTab set={set} />}
        {tab === "flashcards" && <FlashcardsTab set={set} />}
        {tab === "quiz" && <QuizTab set={set} />}
        {tab === "chat" && <ChatTab set={set} />}
        {tab === "podcast" && <PodcastTab set={set} />}
        {tab === "source" && <SourceTab set={set} />}
      </div>

      {showRegen && (
        <RegenDialog
          onClose={() => setShowRegen(false)}
          onRun={(opts) => regenerate(opts)}
          engineLabel={llmActive ? `${PROVIDER_LABELS[settings.provider]} · ${settings.model || "default"}` : "Built-in demo engine"}
        />
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  icon,
  bar,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: IconName;
  bar?: number;
  tone?: "accent" | "muted";
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500">
        <Icon name={icon} size={12} className={tone === "accent" ? "text-accent-300" : ""} />
        {label}
      </div>
      <div className={`mt-1 text-lg font-extrabold leading-none tracking-tight ${tone === "accent" ? "text-accent-300" : "text-white"}`}>
        {value}
      </div>
      {bar !== undefined && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-punch-500 transition-all duration-700" style={{ width: `${Math.max(2, bar)}%` }} />
        </div>
      )}
      {sub && <div className="mt-0.5 truncate text-[10.5px] text-slate-600">{sub}</div>}
    </div>
  );
}

function ExportMenu({ onMarkdown, onJson }: { onMarkdown: () => void; onJson: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)}>
        <Icon name="download" size={15} /> Export
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="panel absolute right-0 z-50 mt-2 w-52 overflow-hidden p-1 shadow-2xl animate-pop">
            {[
              { label: "Markdown (.md)", hint: "notes + cards + quiz + script", fn: onMarkdown },
              { label: "JSON (.json)", hint: "full study set data", fn: onJson },
            ].map((o) => (
              <button
                key={o.label}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/7"
                onClick={() => {
                  o.fn();
                  setOpen(false);
                }}
              >
                <Icon name="file" size={15} className="mt-0.5 text-brand-300" />
                <span>
                  <span className="block text-[13px] font-semibold text-slate-100">{o.label}</span>
                  <span className="block text-[11px] text-slate-500">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RegenDialog({
  onClose,
  onRun,
  engineLabel,
}: {
  onClose: () => void;
  onRun: (opts: { cards: number; questions: number; difficulty: string }) => void;
  engineLabel: string;
}) {
  const [cards, setCards] = useState(16);
  const [questions, setQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState("mixed");

  return (
    <div className="fixed inset-0 z-[65] grid place-items-center bg-ink-950/80 px-4 backdrop-blur-sm">
      <div className="panel w-full max-w-md overflow-hidden p-6 animate-pop">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-extrabold tracking-tight text-white">Regenerate study materials</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
              Rebuilt from the same source with <span className="font-semibold text-slate-200">{engineLabel}</span>. Your
              flashcard progress is preserved where cards match.
            </p>
          </div>
          <button className="btn btn-quiet !px-2 !py-1.5" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between text-[12.5px]">
          <span className="font-semibold text-slate-300">Flashcards</span>
          <input type="number" min={4} max={40} value={cards} onChange={(e) => setCards(Number(e.target.value))} className="input !w-20 !py-1 text-center" />
        </div>
        <div className="mb-4 flex items-center justify-between text-[12.5px]">
          <span className="font-semibold text-slate-300">Quiz questions</span>
          <input type="number" min={3} max={20} value={questions} onChange={(e) => setQuestions(Number(e.target.value))} className="input !w-20 !py-1 text-center" />
        </div>
        <div className="mb-5">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Difficulty</span>
          <div className="grid grid-cols-4 gap-1.5">
            {["easy", "medium", "hard", "mixed"].map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-lg border px-1 py-1.5 text-[11.5px] font-semibold capitalize transition ${
                  difficulty === d ? "border-brand-400/45 bg-brand-500/16 text-white" : "border-white/8 bg-white/2 text-slate-400 hover:bg-white/6"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={() => onRun({ cards, questions, difficulty })}>
            <Icon name="sparkle" size={15} /> Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/25 border-t-white" />;
}

export function SetWorkspace({ set }: { set: StudySet }) {
  return (
    <Suspense fallback={<div className="panel h-72 animate-pulse bg-white/3" />}>
      <WorkspaceInner set={set} />
    </Suspense>
  );
}
