"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell, PageHeader } from "@/components/ui/Shell";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { DEFAULT_MODELS, PROVIDER_LABELS, type Provider } from "@/lib/types";
import { download } from "@/lib/utils";
import { generateFromText } from "@/lib/demo-engine";

const PROVIDERS: {
  id: Provider;
  name: string;
  icon: IconName;
  blurb: string;
  keyHint: string;
  keyPrefixes: string[];
  keyUrl: string;
  models: string[];
}[] = [
  {
    id: "demo",
    name: "Built-in demo engine",
    icon: "bolt",
    blurb: "Runs entirely on your machine. Extracts key terms, definitions and facts to build notes, flashcards, quizzes and a podcast script. No key, no network, no cost.",
    keyHint: "",
    keyPrefixes: [],
    keyUrl: "",
    models: [],
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "sparkle",
    blurb: "Best all-round choice. Also unlocks Whisper transcription for uploaded audio and video files.",
    keyHint: "sk-…",
    keyPrefixes: ["sk-"],
    keyUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o4-mini"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: "brain",
    blurb: "Excellent for long lectures and dense textbook chapters — large context and careful, well-structured notes.",
    keyHint: "sk-ant-…",
    keyPrefixes: ["sk-ant-"],
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-haiku-4-5"],
  },
  {
    id: "google",
    name: "Google Gemini",
    icon: "star",
    blurb: "Fast and cheap with a very large context window — good for whole textbooks at once.",
    keyHint: "AIza…",
    keyPrefixes: ["AIza"],
    keyUrl: "https://aistudio.google.com/app/apikey",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
  },
];

const SHORTCUTS: [string, string][] = [
  ["Space / Enter", "Flip the current flashcard"],
  ["1 · 2 · 3 · 4", "Grade a card: Again, Hard, Good, Easy"],
  ["← →", "Previous / next card or question"],
  ["H", "Show a hint"],
  ["Enter", "Send a message to the tutor"],
  ["Shift + Enter", "New line in any text box"],
];

export default function SettingsPage() {
  const { settings, setSettings, sets, removeSet } = useStore();
  const router = useRouter();

  const [provider, setProvider] = useState<Provider>(settings.provider);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model || DEFAULT_MODELS[settings.provider] || "");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setProvider(settings.provider);
    setApiKey(settings.apiKey);
    setModel(settings.model || DEFAULT_MODELS[settings.provider] || "");
  }, [settings]);

  const active = PROVIDERS.find((p) => p.id === provider)!;

  const detected = apiKey.trim()
    ? PROVIDERS.find((p) => p.keyPrefixes.some((pre) => apiKey.trim().startsWith(pre)))
    : undefined;

  function save(opts?: { silent?: boolean }) {
    setSettings({
      provider,
      apiKey: provider === "demo" ? "" : apiKey.trim(),
      model: provider === "demo" ? "" : model.trim() || DEFAULT_MODELS[provider],
    });
    if (!opts?.silent) toast("Settings saved", "success");
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          model: model.trim() || DEFAULT_MODELS[provider],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setTestResult({ ok: true, message: `Connected. ${data.model || provider} replied “${data.reply}”.` });
        save({ silent: true });
        toast("Connection successful", "success");
      } else {
        setTestResult({ ok: false, message: data.error || "Connection failed." });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || "Connection failed." });
    } finally {
      setTesting(false);
    }
  }

  function exportAll() {
    download(`stormlearn-library-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(sets, null, 2), "application/json");
    toast(`Exported ${sets.length} study sets`, "success");
  }

  function importAll(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data)) throw new Error("Expected an array of study sets.");
        // rehydrate via the demo engine if an imported set has text but no content
        const incoming = data
          .filter((s: any) => s?.id && s?.content)
          .map((s: any) =>
            !s.content.flashcards?.length && s.text
              ? { ...s, content: { ...generateFromText(s.text, { title: s.title || "Imported set" }), ...s.content } }
              : s
          );
        const added = incoming.filter((s: any) => !sets.some((x) => x.id === s.id)).length;
        if (!added) {
          toast("Nothing new to import.", "info");
          return;
        }
        // persist directly then reload so the store picks everything up
        const merged = [...incoming, ...sets];
        const unique = merged.filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
        window.localStorage.setItem("stormlearn.sets.v1", JSON.stringify(unique));
        toast(`Imported ${added} study sets`, "success");
        router.refresh();
        window.location.reload();
      } catch (err: any) {
        toast(err?.message || "That file couldn't be read.", "error");
      }
    };
    reader.readAsText(file);
  }

  const storageKb = typeof window !== "undefined"
    ? Math.round((JSON.stringify(sets).length / 1024) * 10) / 10
    : 0;

  return (
    <Shell>
      <PageHeader
        title="Settings"
        subtitle="StormLearn works out of the box with the built-in engine. Add a provider key whenever you want true LLM generation — the demo engine stays as an automatic fallback."
        right={
          <Link href="/" className="btn btn-ghost">
            <Icon name="arrowLeft" size={15} /> Library
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-5">
          {/* provider picker */}
          <section className="panel p-5">
            <h2 className="mb-1 text-[15px] font-extrabold tracking-tight text-white">AI provider</h2>
            <p className="mb-4 text-[12.5px] leading-relaxed text-slate-400">
              Used for generation, the tutor, note rewriting and audio transcription.
            </p>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProvider(p.id);
                    setModel(p.id === provider ? model : DEFAULT_MODELS[p.id] || "");
                    setTestResult(null);
                  }}
                  className={`panel flex items-start gap-3 p-3.5 text-left transition ${
                    provider === p.id ? "border-brand-400/45 bg-brand-500/10" : "hover:border-white/16 hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      provider === p.id ? "bg-gradient-to-br from-brand-500 to-punch-500 text-white" : "bg-white/6 text-slate-400"
                    }`}
                  >
                    <Icon name={p.icon} size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[13.5px] font-bold text-white">{p.name}</span>
                      {provider === p.id && <Icon name="check" size={13} className="text-emerald-300" />}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">{p.blurb}</span>
                  </span>
                </button>
              ))}
            </div>

            {provider !== "demo" && (
              <div className="mt-5 border-t border-white/7 pt-5">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  API key
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKey ? "text" : "password"}
                      className="input !pr-10 font-mono !text-[12.5px]"
                      placeholder={active.keyHint}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setTestResult(null);
                      }}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                      onClick={() => setShowKey((s) => !s)}
                      title={showKey ? "Hide key" : "Show key"}
                      type="button"
                    >
                      <Icon name="eye" size={15} />
                    </button>
                  </div>
                  <a className="btn btn-ghost" href={active.keyUrl} target="_blank" rel="noreferrer">
                    Get a key
                  </a>
                </div>

                {detected && detected.id !== provider && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-accent-300">
                    <Icon name="info" size={13} /> That looks like a {detected.name} key —{" "}
                    <button className="font-semibold underline underline-offset-2" onClick={() => { setProvider(detected.id); setModel(DEFAULT_MODELS[detected.id] || ""); }}>
                      switch provider
                    </button>
                  </p>
                )}

                <label className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Model
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {active.models.map((m) => (
                    <button
                      key={m}
                      onClick={() => setModel(m)}
                      className={`chip !cursor-pointer font-mono !text-[11px] transition ${
                        model === m ? "!border-brand-400/45 !bg-brand-500/18 !text-brand-100" : "hover:!bg-white/8"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                  <input
                    className="input !w-44 !py-1 font-mono !text-[11.5px]"
                    placeholder="or type a model id"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button className="btn btn-ghost" onClick={test} disabled={testing || apiKey.trim().length < 8}>
                    {testing ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/25 border-t-white" /> : <Icon name="target" size={15} />}
                    {testing ? "Testing…" : "Test connection"}
                  </button>
                  <button className="btn btn-primary" onClick={() => save()}>
                    <Icon name="check" size={15} /> Save settings
                  </button>
                  {testResult && (
                    <span className={`flex items-center gap-1.5 text-[12px] ${testResult.ok ? "text-emerald-300" : "text-rose-300"}`}>
                      <Icon name={testResult.ok ? "check" : "x"} size={13} />
                      {testResult.message}
                    </span>
                  )}
                </div>

                <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/7 bg-white/2 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-slate-500">
                  <Icon name="info" size={13} className="mt-0.5 shrink-0" />
                  Your key is stored in this browser's local storage and sent only to {PROVIDER_LABELS[provider]} and this
                  app's own API routes. It never touches any other service, and clearing site data removes it.
                </p>
              </div>
            )}

            {provider === "demo" && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-accent-400/20 bg-accent-400/6 p-4">
                <Icon name="bolt" size={17} className="mt-0.5 shrink-0 text-accent-300" />
                <p className="text-[12.5px] leading-relaxed text-amber-100/85">
                  <span className="font-bold text-amber-100">Demo engine active.</span> Generation, the tutor and note
                  rewriting all run locally by extracting key terms, definitions, numbers and the most information-dense
                  sentences from your source. Add a provider key to switch to a real model — everything else stays the
                  same.
                </p>
              </div>
            )}
          </section>

          {/* data */}
          <section className="panel p-5">
            <h2 className="mb-1 text-[15px] font-extrabold tracking-tight text-white">Your library</h2>
            <p className="mb-4 text-[12.5px] text-slate-400">
              {sets.length} study set{sets.length === 1 ? "" : "s"} · ~{storageKb} KB · stored in this browser only
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost" onClick={exportAll} disabled={!sets.length}>
                <Icon name="download" size={15} /> Export all (JSON)
              </button>
              <label className={`btn btn-ghost ${!sets.length ? "" : ""}`}>
                <Icon name="upload" size={15} /> Import
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importAll(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                className="btn btn-danger"
                disabled={!sets.length}
                onClick={() => {
                  if (!window.confirm(`Delete all ${sets.length} study sets from this browser? This cannot be undone.`)) return;
                  sets.forEach((s) => removeSet(s.id));
                  toast("Library cleared", "info");
                }}
              >
                <Icon name="trash" size={15} /> Delete everything
              </button>
            </div>
          </section>

          {/* shortcuts */}
          <section className="panel p-5">
            <h2 className="mb-3 text-[15px] font-extrabold tracking-tight text-white">Keyboard shortcuts</h2>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {SHORTCUTS.map(([key, what]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-white/2 px-3 py-2">
                  <span className="text-[12.5px] text-slate-400">{what}</span>
                  <kbd className="shrink-0 rounded-md border border-white/12 bg-ink-950 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* right rail */}
        <aside className="flex flex-col gap-4">
          <div className="panel p-4">
            <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Supported inputs</h3>
            <ul className="flex flex-col gap-2 text-[12.5px] text-slate-300">
              {[
                ["paste", "Pasted notes, articles, transcripts"],
                ["file", "PDF, DOCX, PPTX, TXT, MD, CSV"],
                ["mic", "Live lecture recording (browser speech)"],
                ["upload", "MP3 / M4A / WAV / MP4 (Whisper, needs OpenAI key)"],
                ["youtube", "YouTube links — captions fetched automatically"],
                ["notes", "Blank page you write yourself"],
              ].map(([icon, label]) => (
                <li key={label} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/6 text-brand-300">
                    <Icon name={icon as IconName} size={12} />
                  </span>
                  <span className="leading-snug">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-4">
            <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Generated per set</h3>
            <ul className="flex flex-col gap-1.5 text-[12.5px] text-slate-400">
              {["Structured editable notes", "Spaced-repetition flashcards", "MCQ + cloze + short answer quiz", "Two-host study podcast", "Source-grounded AI tutor", "Key terms, facts & outline"].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <Icon name="check" size={12} className="shrink-0 text-emerald-400" />
                  {x}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-4 text-[12px] leading-relaxed text-slate-500">
            <Icon name="info" size={14} className="mb-1.5 text-slate-600" />
            No account, no server database. Your study sets live in this browser — export a JSON backup before clearing
            site data.
          </div>
        </aside>
      </div>
    </Shell>
  );
}
