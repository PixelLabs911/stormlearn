"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/ui/Shell";
import { Icon, type IconName } from "@/components/ui/Icon";
import { FileDrop, type PickedFile } from "@/components/create/FileDrop";
import { Recorder } from "@/components/create/Recorder";
import { GeneratingOverlay } from "@/components/create/GeneratingOverlay";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { PROVIDER_LABELS, type StudySet } from "@/lib/types";
import { SAMPLES } from "@/lib/samples";
import { colorFor, emojiFor, minutesFromWords, uid, words, youtubeId } from "@/lib/utils";

type Mode = "paste" | "upload" | "youtube" | "record" | "blank";

const MODES: { id: Mode; label: string; icon: IconName; hint: string }[] = [
  { id: "paste", label: "Paste text", icon: "paste", hint: "Notes, transcripts, articles" },
  { id: "upload", label: "Upload", icon: "upload", hint: "PDF, DOCX, slides, audio" },
  { id: "youtube", label: "YouTube", icon: "youtube", hint: "Pull captions automatically" },
  { id: "record", label: "Record live", icon: "mic", hint: "AI notetaker for lectures" },
  { id: "blank", label: "Blank page", icon: "notes", hint: "Write it yourself" },
];

const SUBJECT_LIST = [
  "Biology", "Chemistry", "Physics", "Math", "History", "Literature", "Economics",
  "Psychology", "Computer Science", "Medicine", "Law", "Business", "Philosophy",
  "Geography", "Other",
];

function NewPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { addSet, settings, llmActive, sets } = useStore();

  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Other");
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [ytMeta, setYtMeta] = useState<{ title: string; videoId: string } | null>(null);
  const [ytBusy, setYtBusy] = useState(false);
  const [cards, setCards] = useState(14);
  const [questions, setQuestions] = useState(8);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sampleParam = params.get("sample");

  // Load a sample straight into the editor when linked from the empty library.
  useEffect(() => {
    if (!sampleParam) return;
    const sample = SAMPLES.find((s) => s.id === sampleParam);
    if (!sample) return;
    setMode(sample.origin === "transcribed" ? "record" : "paste");
    setText(sample.text);
    setTitle(sample.title);
    setSubject(sample.subject);
    toast(`Loaded sample: ${sample.title}`, "success");
  }, [sampleParam]);

  const wordCount = useMemo(() => words(text), [text]);
  const canGenerate = wordCount >= 25;

  const onPickFile = useCallback((f: PickedFile) => {
    setPicked(f);
    setText(f.text);
    const guessed = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    setTitle((prev) => prev || guessed.slice(0, 90));
  }, []);

  const fetchYoutube = useCallback(async () => {
    const id = youtubeId(ytUrl);
    if (!id) {
      toast("That doesn't look like a YouTube link.", "error");
      return;
    }
    setYtBusy(true);
    setYtMeta(null);
    try {
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: ytUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok && data.transcript) {
        setYtMeta({ title: data.title, videoId: id });
        setText(data.transcript);
        setTitle((prev) => prev || data.title);
        toast(`Pulled captions for “${data.title}”`, "success");
      } else {
        setYtMeta({ title: data?.title || `YouTube video ${id}`, videoId: id });
        toast(data?.error || "No captions found for that video.", "error");
      }
    } catch {
      toast("Couldn't reach YouTube. Paste the transcript instead.", "error");
    } finally {
      setYtBusy(false);
    }
  }, [ytUrl]);

  const engineLabel = llmActive ? `${PROVIDER_LABELS[settings.provider]} · ${settings.model || "default"}` : "Built-in demo engine";

  async function generate() {
    if (!canGenerate) {
      toast("Add at least ~25 words of source material.", "error");
      return;
    }
    setGenerating(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const finalTitle = (title.trim() || picked?.name?.replace(/\.[^.]+$/, "") || ytMeta?.title || "Untitled study set").slice(0, 140);

      if (mode === "blank") {
        const set: StudySet = {
          id: uid("set"),
          title: finalTitle,
          subject,
          color: colorFor(sets.length),
          emoji: emojiFor(subject),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: { kind: "text", title: finalTitle, origin: "typed" },
          text,
          content: {
            summary: "A blank page. Start writing — then hit **Generate** to build flashcards, a quiz and a podcast from your notes.",
            outline: [],
            keyTerms: [],
            facts: [],
            sections: [],
            notesMarkdown: `# ${finalTitle}\n\nStart writing here…`,
            flashcards: [],
            questions: [],
            podcast: [],
            podcastTitle: `Storm Sessions — ${finalTitle}`,
          },
          engine: "demo",
          stats: { cardsStudied: 0, quizzesTaken: 0, bestScore: 0, podcastPlays: 0, minutes: 0 },
        };
        addSet(set);
        router.push(`/set/${set.id}?tab=notes`);
        return;
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          text,
          source: {
            kind: mode === "youtube" ? "youtube" : picked?.kind || "text",
            title: finalTitle,
            fileName: picked?.name,
            videoId: ytMeta?.videoId,
            origin: mode === "record" ? "transcribed" : picked ? "extracted" : "pasted",
          },
          options: { cards, questions, difficulty, includePodcast: true },
          settings: llmActive ? settings : undefined,
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Generation failed (${res.status}).`);

      data.warnings?.forEach((w: string) => toast(w, "info"));

      const set: StudySet = {
        id: uid("set"),
        title: finalTitle,
        subject,
        color: colorFor(sets.length),
        emoji: emojiFor(subject),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: {
          kind: mode === "youtube" ? "youtube" : picked?.kind || "text",
          title: finalTitle,
          fileName: picked?.name,
          videoId: ytMeta?.videoId,
          origin: mode === "record" ? "transcribed" : picked ? "extracted" : "pasted",
        },
        text,
        transcript: mode === "record" || picked?.kind === "audio" ? text : undefined,
        content: data.content,
        engine: data.engine,
        model: data.model,
        stats: { cardsStudied: 0, quizzesTaken: 0, bestScore: 0, podcastPlays: 0, minutes: minutesFromWords(text) },
      };
      addSet(set);
      toast(
        data.engine === "llm"
          ? `Generated with ${PROVIDER_LABELS[settings.provider]}`
          : "Generated with the built-in engine",
        "success"
      );
      router.push(`/set/${set.id}`);
    } catch (err: any) {
      if (err?.name === "AbortError") toast("Generation cancelled.", "info");
      else toast(err?.message || "Generation failed.", "error");
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  }

  return (
    <Shell>
      {generating && (
        <GeneratingOverlay
          title={title || picked?.name || "Untitled"}
          engineLabel={engineLabel}
          onCancel={() => abortRef.current?.abort()}
        />
      )}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-200">
            <Icon name="arrowLeft" size={14} /> Library
          </Link>
          <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-tight text-white sm:text-[1.9rem]">
            Turn anything into <span className="text-gradient">study materials</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
            One source in — notes, flashcards, a quiz, a study podcast and a tutor out.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${llmActive ? "bg-emerald-400" : "bg-accent-400"}`} />
          <span className="font-semibold text-slate-300">{engineLabel}</span>
          <Link href="/settings" className="font-semibold text-brand-300 hover:text-brand-200">change</Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20.5rem]">
        {/* ---------------------------- left: input ---------------------------- */}
        <div className="flex flex-col gap-5">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`panel flex min-w-[9.5rem] flex-1 items-start gap-2.5 p-3 text-left transition ${
                  mode === m.id ? "border-brand-400/45 bg-brand-500/10" : "hover:border-white/16 hover:bg-white/5"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    mode === m.id ? "bg-gradient-to-br from-brand-500 to-punch-500 text-white" : "bg-white/6 text-slate-400"
                  }`}
                >
                  <Icon name={m.icon} size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-white">{m.label}</span>
                  <span className="block truncate text-[11px] text-slate-500">{m.hint}</span>
                </span>
              </button>
            ))}
          </div>

          {mode === "paste" && (
            <div className="panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Source text</label>
                <div className="flex items-center gap-1.5">
                  {SAMPLES.slice(0, 2).map((s) => (
                    <button
                      key={s.id}
                      className="chip !cursor-pointer hover:!bg-white/9"
                      onClick={() => {
                        setText(s.text);
                        setTitle(s.title);
                        setSubject(s.subject);
                      }}
                    >
                      {s.emoji} {s.subject}
                    </button>
                  ))}
                  <button className="btn btn-quiet !px-2 !py-1 text-[11px]" onClick={() => setText("")} disabled={!text}>
                    <Icon name="trash" size={13} /> Clear
                  </button>
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={16}
                placeholder="Paste a lecture transcript, an article, textbook pages, your rough notes… anything with substance in it."
                className="input resize-y leading-relaxed"
              />
              <p className="mt-2 text-[11.5px] text-slate-500">
                {wordCount} words · ~{minutesFromWords(text || "x")} min read · processed in your session
              </p>
            </div>
          )}

          {mode === "upload" && (
            <>
              <FileDrop onFile={onPickFile} audioApiKey={settings.provider === "openai" ? settings.apiKey : ""} />
              {picked && (
                <div className="panel flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-punch-500 text-white">
                    <Icon name={picked.kind === "pdf" ? "file" : picked.kind === "audio" ? "mic" : "paste"} size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{picked.name}</p>
                    <p className="text-[11.5px] text-slate-500">
                      {words(picked.text)} words extracted · {(picked.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button className="btn btn-quiet !px-2 !py-1.5" onClick={() => { setPicked(null); setText(""); }} title="Remove">
                    <Icon name="x" size={15} />
                  </button>
                </div>
              )}
            </>
          )}

          {mode === "youtube" && (
            <div className="panel p-4">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                YouTube link
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  className="input min-w-[14rem] flex-1"
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchYoutube()}
                />
                <button className="btn btn-primary" onClick={fetchYoutube} disabled={ytBusy || !ytUrl.trim()}>
                  {ytBusy ? "Fetching captions…" : "Fetch transcript"}
                </button>
              </div>

              {ytMeta && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://i.ytimg.com/vi/${ytMeta.videoId}/mqdefault.jpg`}
                    alt=""
                    className="h-16 w-28 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{ytMeta.title}</p>
                    <p className="text-[11.5px] text-slate-500">
                      {text ? `${words(text)} words of captions ready` : "No captions available — paste the transcript below"}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Transcript {ytMeta && <span className="normal-case tracking-normal text-slate-600">(editable)</span>}
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  placeholder="Captions land here. If the video has no captions, paste a transcript or your notes on the topic."
                  className="input resize-y leading-relaxed"
                />
              </div>
              <p className="mt-2 flex items-start gap-2 text-[11.5px] leading-relaxed text-slate-500">
                <Icon name="info" size={13} className="mt-0.5 shrink-0" />
                Captions are fetched server-side from YouTube. Videos without captions (or with restricted captions) need
                a pasted transcript.
              </p>
            </div>
          )}

          {mode === "record" && (
            <Recorder text={text} setText={setText} onText={setText} />
          )}

          {mode === "blank" && (
            <div className="panel p-4">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Your notes
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={16}
                placeholder="Start from scratch. Write as much or as little as you like — once there's enough text you can generate flashcards, a quiz and a podcast from it."
                className="input resize-y leading-relaxed"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="btn btn-ghost text-xs"
                  onClick={() => {
                    const t = (title.trim() || "Untitled study set");
                    setText(`# ${t}\n\n`);
                  }}
                >
                  <Icon name="notes" size={14} /> Start with a heading
                </button>
                <button
                  className="btn btn-ghost text-xs"
                  disabled={wordCount < 25}
                  onClick={generate}
                >
                  <Icon name="sparkle" size={14} /> Generate materials from this
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --------------------------- right: options --------------------------- */}
        <aside className="flex flex-col gap-4">
          <div className="panel p-4">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cellular Respiration — Lecture 6"
            />

            <label className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Subject
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECT_LIST.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={`chip !cursor-pointer transition ${
                    subject === s ? "!border-brand-400/45 !bg-brand-500/18 !text-brand-100" : "hover:!bg-white/8"
                  }`}
                >
                  {emojiFor(s)} {s}
                </button>
              ))}
            </div>
          </div>

          <div className="panel p-4">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Output</h3>

            <Slider label="Flashcards" value={cards} min={5} max={30} onChange={setCards} icon="cards" />
            <Slider label="Quiz questions" value={questions} min={3} max={20} onChange={setQuestions} icon="quiz" />

            <label className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Difficulty
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["easy", "medium", "hard", "mixed"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-lg border px-1 py-1.5 text-[11.5px] font-semibold capitalize transition ${
                    difficulty === d
                      ? "border-brand-400/45 bg-brand-500/16 text-white"
                      : "border-white/8 bg-white/2 text-slate-400 hover:bg-white/6"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary w-full !py-3.5 text-[15px]" onClick={generate} disabled={!canGenerate}>
            <Icon name="bolt" size={18} />
            {mode === "blank" ? "Create blank study set" : "Generate study materials"}
          </button>
          {!canGenerate && (
            <p className="-mt-2 text-center text-[11.5px] text-slate-500">
              Add at least 25 words of source material to enable generation.
            </p>
          )}

          <div className="panel p-4">
            <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">You'll get</h3>
            <ul className="flex flex-col gap-2 text-[12.5px] text-slate-300">
              {[
                { icon: "notes" as IconName, label: "Structured, editable notes", sub: "summary, key terms, sections" },
                { icon: "cards" as IconName, label: "Spaced-repetition flashcards", sub: "definitions, cloze, significance" },
                { icon: "quiz" as IconName, label: "Mixed-format quiz", sub: "MCQ, fill-in-the-blank, short answer" },
                { icon: "podcast" as IconName, label: "Two-host study podcast", sub: "plays aloud in your browser" },
                { icon: "chat" as IconName, label: "Tutor grounded in your source", sub: "answers with citations" },
              ].map((r) => (
                <li key={r.label} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/6 text-brand-300">
                    <Icon name={r.icon} size={13} />
                  </span>
                  <span>
                    <span className="block font-semibold">{r.label}</span>
                    <span className="block text-[11px] text-slate-500">{r.sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  icon,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  icon: IconName;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
        <span className="flex items-center gap-1.5 font-semibold text-slate-300">
          <Icon name={icon} size={13} className="text-slate-500" />
          {label}
        </span>
        <span className="rounded-md bg-white/6 px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand-200">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-brand-500"
      />
    </div>
  );
}

export default function NewPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="panel h-64 animate-pulse bg-white/3" />
        </Shell>
      }
    >
      <NewPageInner />
    </Suspense>
  );
}
