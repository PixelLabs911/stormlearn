"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { freshCard } from "@/lib/srs";
import type { Question, StudySet } from "@/lib/types";
import { renderMarkdown, shuffle } from "@/lib/utils";

type Phase = "setup" | "run" | "result";

interface AnswerState {
  picked?: number;
  typed?: string;
  open?: string;
  revealed?: boolean;
  correct?: boolean;
  selfGrade?: "got" | "missed";
}

function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[.,;:!?'"’“”()\[\]]/g, "")
    .replace(/\b(a|an|the)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clozeCorrect(typed: string, answer: string) {
  const a = normalise(answer);
  const b = normalise(typed);
  if (!b) return false;
  if (a === b) return true;
  if (a.includes(b) && b.length >= Math.max(3, a.length * 0.6)) return true;
  // tolerate small typos
  if (Math.abs(a.length - b.length) <= 2 && levenshtein(a, b) <= 2) return true;
  return false;
}

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function QuizTab({ set }: { set: StudySet }) {
  const { updateSet } = useStore();
  const bank = set.content.questions;

  const [phase, setPhase] = useState<Phase>(bank.length ? "setup" : "setup");
  const [config, setConfig] = useState({ count: Math.min(10, bank.length || 8), types: { mc: true, cloze: true, open: true }, instant: true, shuffleOptions: true });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [i, setI] = useState(0);

  const start = useCallback(() => {
    let pool = bank.filter((q) => config.types[q.type]);
    if (!pool.length) pool = bank;
    let picked = shuffle(pool).slice(0, Math.max(1, Math.min(config.count, pool.length)));
    if (config.shuffleOptions) {
      picked = picked.map((q) => {
        if (q.type !== "mc" || !q.options) return q;
        const opts = shuffle(q.options);
        return { ...q, options: opts, answerIndex: opts.indexOf(q.answer) };
      });
    }
    setQuestions(picked);
    setAnswers(picked.map(() => ({})));
    setI(0);
    setPhase("run");
  }, [bank, config]);

  const q = questions[i];
  const a = answers[i] || {};

  const patchAnswer = (patch: AnswerState) => setAnswers((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const score = useMemo(() => {
    let correct = 0;
    let graded = 0;
    answers.forEach((ans, idx) => {
      const qq = questions[idx];
      if (!qq) return;
      if (qq.type === "open") {
        if (ans.selfGrade) {
          graded += 1;
          if (ans.selfGrade === "got") correct += 1;
        }
      } else if (ans.correct !== undefined) {
        graded += 1;
        if (ans.correct) correct += 1;
      }
    });
    return { correct, graded, total: questions.length };
  }, [answers, questions]);

  const finish = useCallback(() => {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    updateSet(set.id, (s) => ({
      stats: {
        ...s.stats,
        quizzesTaken: s.stats.quizzesTaken + 1,
        bestScore: Math.max(s.stats.bestScore || 0, pct),
      },
    }));
    setPhase("result");
  }, [score, set.id, updateSet]);

  useEffect(() => {
    if (phase !== "run") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /input|textarea/i.test(t.tagName)) return;
      if (e.key === "ArrowRight" && (a.revealed || q?.type === "mc" ? a.picked !== undefined : true)) {
        if (i + 1 < questions.length) setI(i + 1);
      } else if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, a, q, i, questions.length]);

  if (!bank.length) {
    return (
      <div className="panel grid place-items-center px-6 py-16 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/6 p-3.5 text-slate-400">
          <Icon name="quiz" size={24} />
        </span>
        <h2 className="text-lg font-extrabold text-white">No quiz yet</h2>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-400">
          Regenerate this study set (top right) to build a mixed-format quiz from the source material — multiple choice,
          fill-in-the-blank and short answer, each with an explanation.
        </p>
      </div>
    );
  }

  /* --------------------------------- setup -------------------------------- */
  if (phase === "setup") {
    const counts = {
      mc: bank.filter((x) => x.type === "mc").length,
      cloze: bank.filter((x) => x.type === "cloze").length,
      open: bank.filter((x) => x.type === "open").length,
    };
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="panel p-6">
          <h2 className="text-xl font-extrabold tracking-tight text-white">Practice until it clicks</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-400">
            {bank.length} questions in the bank for <span className="font-semibold text-slate-200">{set.title}</span>. Endless
            rounds until you lock in the understanding.
          </p>

          <div className="mt-6">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Question types</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["mc", "cloze", "open"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setConfig((c) => ({ ...c, types: { ...c.types, [t]: !c.types[t] } }))}
                  disabled={!counts[t]}
                  className={`panel flex items-center gap-3 p-3 text-left transition ${
                    config.types[t] ? "border-brand-400/45 bg-brand-500/10" : "opacity-60"
                  } ${counts[t] ? "cursor-pointer hover:bg-white/5" : "cursor-not-allowed"}`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${config.types[t] ? "bg-gradient-to-br from-brand-500 to-punch-500 text-white" : "bg-white/6 text-slate-400"}`}>
                    <Icon name={t === "mc" ? "quiz" : t === "cloze" ? "edit" : "chat"} size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-white">
                      {t === "mc" ? "Multiple choice" : t === "cloze" ? "Fill in the blank" : "Short answer"}
                    </span>
                    <span className="block text-[11px] text-slate-500">{counts[t]} available</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Questions <span className="font-mono text-brand-200">{config.count}</span>
              </label>
              <input
                type="range"
                min={3}
                max={Math.max(3, bank.length)}
                value={Math.min(config.count, bank.length)}
                onChange={(e) => setConfig((c) => ({ ...c, count: Number(e.target.value) }))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-brand-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Toggle label="Instant feedback" checked={config.instant} onChange={(v) => setConfig((c) => ({ ...c, instant: v }))} />
              <Toggle label="Shuffle options" checked={config.shuffleOptions} onChange={(v) => setConfig((c) => ({ ...c, shuffleOptions: v }))} />
            </div>
          </div>

          <button className="btn btn-primary mt-7 w-full !py-3.5 text-[15px]" onClick={start}>
            <Icon name="bolt" size={17} /> Start quiz
          </button>
        </div>

        <aside className="flex flex-col gap-3">
          <div className="panel p-4">
            <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Your record</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold leading-none text-white">{set.stats.bestScore || 0}%</span>
              <span className="pb-1 text-[11.5px] text-slate-500">best score</span>
            </div>
            <p className="mt-2 text-[12px] text-slate-500">{set.stats.quizzesTaken} quizzes taken so far</p>
          </div>
          <div className="panel p-4">
            <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Sample questions</h3>
            <ul className="flex flex-col gap-2.5">
              {shuffle(bank).slice(0, 3).map((x) => (
                <li key={x.id} className="rounded-lg border border-white/7 bg-white/2 px-3 py-2 text-[12px] leading-snug text-slate-300">
                  <span className="mr-1.5 rounded bg-white/7 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-slate-400">{x.type}</span>
                  {x.prompt.replace(/\*\*/g, "").slice(0, 110)}
                  {x.prompt.length > 110 ? "…" : ""}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    );
  }

  /* --------------------------------- result -------------------------------- */
  if (phase === "result") {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    const missed = questions.filter((qq, idx) => {
      const ans = answers[idx] || {};
      if (qq.type === "open") return ans.selfGrade === "missed";
      return ans.correct === false;
    });

    return (
      <div className="flex flex-col gap-4">
        <div className="panel relative overflow-hidden p-7 text-center">
          <div className={`pointer-events-none absolute inset-0 ${pct >= 70 ? "bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.16),transparent_60%)]" : pct >= 40 ? "bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.14),transparent_60%)]" : "bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.14),transparent_60%)]"}`} />
          <div className="relative">
            <ScoreRing pct={pct} />
            <h2 className="mt-4 text-xl font-extrabold tracking-tight text-white">
              {pct >= 85 ? "Locked in. 🔥" : pct >= 60 ? "Solid — a few gaps to close" : pct >= 35 ? "Getting there" : "Worth another pass"}
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              {score.correct} of {score.total} correct · best score {set.stats.bestScore}%
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary" onClick={() => setPhase("setup")}>
                <Icon name="refresh" size={15} /> New round
              </button>
              {missed.length > 0 && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    const added = missed.map((qq) =>
                      freshCard(
                        qq.type === "mc" ? qq.prompt.replace(/\*\*/g, "") : qq.prompt,
                        qq.answer,
                        qq.explanation ? qq.explanation.slice(0, 90) : undefined,
                        ["from quiz"]
                      )
                    );
                    updateSet(set.id, (s) => ({ content: { ...s.content, flashcards: [...added, ...s.content.flashcards] } }));
                    toast(`${added.length} missed questions turned into flashcards`, "success");
                  }}
                >
                  <Icon name="cards" size={15} /> Turn {missed.length} misses into cards
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => { setPhase("run"); setI(0); }}>
                <Icon name="eye" size={15} /> Review answers
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {questions.map((qq, idx) => {
            const ans = answers[idx] || {};
            const ok = qq.type === "open" ? ans.selfGrade === "got" : ans.correct;
            return (
              <div key={qq.id} className="panel flex gap-3 p-4">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${ok ? "bg-emerald-500/18 text-emerald-300" : "bg-rose-500/16 text-rose-300"}`}>
                  <Icon name={ok ? "check" : "x"} size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold leading-snug text-white" dangerouslySetInnerHTML={{ __html: renderMarkdown(qq.prompt) }} />
                  <p className="mt-1 text-[12.5px] text-slate-400">
                    <span className="font-semibold text-slate-500">Answer:</span>{" "}
                    <span className="text-emerald-200">{qq.answer}</span>
                    {ans.typed && !ok && <span className="ml-2 text-rose-300">you wrote: {ans.typed}</span>}
                  </p>
                  {qq.explanation && <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{qq.explanation}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------------------------------- run ---------------------------------- */
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between text-[11.5px] text-slate-500">
          <span>
            Question {i + 1} of {questions.length}
          </span>
          <span className="flex items-center gap-2">
            <span className="rounded bg-white/6 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{q.type === "mc" ? "multiple choice" : q.type === "cloze" ? "fill in the blank" : "short answer"}</span>
            <span className="chip !py-0.5 !text-[10px]">{q.difficulty}</span>
            <button className="btn btn-quiet !px-2 !py-1 text-[11.5px]" onClick={() => setPhase("setup")}>
              <Icon name="x" size={13} /> Quit
            </button>
          </span>
        </div>

        <div className="mb-4 flex gap-1">
          {questions.map((_, idx) => {
            const ans = answers[idx] || {};
            const ok = questions[idx].type === "open" ? ans.selfGrade === "got" : ans.correct;
            return (
              <button
                key={idx}
                onClick={() => setI(idx)}
                className={`h-1.5 flex-1 rounded-full transition ${
                  idx === i
                    ? "bg-gradient-to-r from-brand-400 to-punch-400"
                    : ans.revealed || ans.selfGrade
                      ? ok
                        ? "bg-emerald-500/55"
                        : "bg-rose-500/50"
                      : "bg-white/9 hover:bg-white/20"
                }`}
                aria-label={`Go to question ${idx + 1}`}
              />
            );
          })}
        </div>

        <div className="panel p-6">
          <p className="text-[1.05rem] font-semibold leading-snug text-white sm:text-[1.15rem]" dangerouslySetInnerHTML={{ __html: renderMarkdown(q.prompt) }} />

          {q.type === "mc" && (
            <div className="mt-5 flex flex-col gap-2">
              {(q.options || []).map((opt, oi) => {
                const picked = a.picked === oi;
                const isAnswer = oi === q.answerIndex;
                const show = a.revealed && config.instant;
                return (
                  <button
                    key={oi}
                    disabled={show}
                    onClick={() => {
                      patchAnswer({ picked: oi });
                      if (config.instant) patchAnswer({ picked: oi, revealed: true, correct: isAnswer });
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13.5px] transition ${
                      show && isAnswer
                        ? "border-emerald-400/45 bg-emerald-500/12 text-emerald-50"
                        : show && picked
                          ? "border-rose-400/45 bg-rose-500/10 text-rose-50"
                          : picked
                            ? "border-brand-400/50 bg-brand-500/12 text-white"
                            : "border-white/8 bg-white/2 text-slate-300 hover:border-white/18 hover:bg-white/6"
                    }`}
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-[11px] font-bold ${picked || (show && isAnswer) ? "border-transparent bg-white/18 text-white" : "border-white/12 text-slate-500"}`}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {show && isAnswer && <Icon name="check" size={15} className="text-emerald-300" />}
                    {show && picked && !isAnswer && <Icon name="x" size={15} className="text-rose-300" />}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "cloze" && (
            <div className="mt-5">
              <input
                className="input !py-3 !text-[15px]"
                placeholder="Type the missing term…"
                value={a.typed || ""}
                disabled={a.revealed && config.instant}
                onChange={(e) => patchAnswer({ typed: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && a.typed?.trim()) {
                    const ok = clozeCorrect(a.typed, q.answer);
                    patchAnswer({ revealed: true, correct: ok });
                  }
                }}
                autoComplete="off"
              />
              {a.revealed && (
                <div className={`mt-3 rounded-xl border px-4 py-3 text-[13px] animate-pop ${a.correct ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100" : "border-rose-400/35 bg-rose-500/10 text-rose-100"}`}>
                  <span className="font-bold">{a.correct ? "Correct. " : `Not quite — it's “${q.answer}”. `}</span>
                  {q.explanation}
                </div>
              )}
            </div>
          )}

          {q.type === "open" && (
            <div className="mt-5">
              <textarea
                className="input resize-y leading-relaxed"
                rows={5}
                placeholder="Write your answer out — as if you were writing it on the exam."
                value={a.open || ""}
                onChange={(e) => patchAnswer({ open: e.target.value })}
              />
              {a.revealed && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/3 p-4 animate-pop">
                  <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Model answer</div>
                  <p className="text-[13.5px] leading-relaxed text-slate-200">{q.answer}</p>
                  {q.explanation && <p className="mt-2 text-[12px] leading-relaxed text-slate-500">{q.explanation}</p>}
                  <div className="mt-3 flex gap-2">
                    {(["got", "missed"] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => patchAnswer({ selfGrade: g })}
                        className={`btn ${a.selfGrade === g ? (g === "got" ? "border border-emerald-400/45 bg-emerald-500/16 text-emerald-100" : "btn-danger") : "btn-ghost"} !py-1.5 text-[12.5px]`}
                      >
                        <Icon name={g === "got" ? "check" : "x"} size={13} />
                        {g === "got" ? "I had that" : "I missed it"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {q.source && a.revealed && (
            <p className="mt-3 border-l-2 border-brand-400/40 pl-3 text-[12px] italic leading-relaxed text-slate-500">
              From the source: “{q.source}”
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button className="btn btn-ghost !px-3" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
            <Icon name="chevronLeft" size={15} />
          </button>

          {q.type === "mc" && !a.revealed && (
            <button
              className="btn btn-primary flex-1 !py-3"
              disabled={a.picked === undefined}
              onClick={() => patchAnswer({ revealed: true, correct: a.picked === q.answerIndex })}
            >
              <Icon name="check" size={15} /> Check answer
            </button>
          )}
          {q.type === "cloze" && !a.revealed && (
            <button className="btn btn-primary flex-1 !py-3" disabled={!a.typed?.trim()} onClick={() => patchAnswer({ revealed: true, correct: clozeCorrect(a.typed || "", q.answer) })}>
              <Icon name="check" size={15} /> Check answer
            </button>
          )}
          {q.type === "open" && !a.revealed && (
            <button className="btn btn-primary flex-1 !py-3" disabled={!a.open?.trim()} onClick={() => patchAnswer({ revealed: true })}>
              <Icon name="eye" size={15} /> Show model answer
            </button>
          )}

          {i + 1 < questions.length ? (
            <button className="btn btn-ghost flex-1 !py-3" onClick={() => setI(i + 1)}>
              Next question <Icon name="chevronRight" size={15} />
            </button>
          ) : (
            <button className="btn btn-primary flex-1 !py-3" onClick={finish}>
              <Icon name="target" size={15} /> Finish quiz
            </button>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <div className="panel p-4">
          <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Running score</h3>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-extrabold leading-none text-white">{score.correct}</span>
            <span className="pb-0.5 text-[12px] text-slate-500">/ {score.total}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500" style={{ width: `${score.total ? (score.correct / score.total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="panel p-4 text-[12px] leading-relaxed text-slate-400">
          <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Exam technique</h3>
          <p>Answer before you check. If you hesitate for more than a few seconds, mark it — hesitation is the thing to revise, not the wrong answer.</p>
        </div>
      </aside>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between rounded-xl border border-white/8 bg-white/2 px-3 py-2 text-[12.5px] font-semibold text-slate-300 transition hover:bg-white/5"
    >
      {label}
      <span className={`relative h-4.5 w-8 rounded-full transition ${checked ? "bg-brand-500" : "bg-white/12"}`} style={{ height: 18 }}>
        <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${checked ? "left-[1.05rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function ScoreRing({ pct }: { pct: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const colour = pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#fb7185";
  return (
    <div className="relative mx-auto grid h-32 w-32 place-items-center">
      <svg viewBox="0 0 110 110" className="absolute inset-0 -rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="text-center">
        <div className="text-3xl font-extrabold leading-none text-white">{pct}%</div>
        <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">score</div>
      </div>
    </div>
  );
}
