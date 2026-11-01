"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { analyze } from "@/lib/demo-engine";
import type { StudySet } from "@/lib/types";
import { copyText, minutesFromWords, words } from "@/lib/utils";

export function SourceTab({ set }: { set: StudySet }) {
  const { updateSet } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(set.text);
  const [query, setQuery] = useState("");

  const stats = useMemo(() => {
    const w = words(set.text);
    const a = set.text ? analyze(set.text) : null;
    return {
      words: w,
      minutes: minutesFromWords(set.text || "x"),
      sentences: a?.sentences.length ?? 0,
      terms: a?.terms.length ?? 0,
    };
  }, [set.text]);

  const highlighted = useMemo(() => {
    const q = query.trim();
    const text = set.transcript || set.text;
    if (!q) return text;
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp(`(${safe})`, "gi"), "\u0000$1\u0001");
  }, [query, set.text, set.transcript]);

  const matches = query.trim() ? (highlighted.match(/\u0000/g)?.length ?? 0) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {set.source.videoId && (
          <div className="panel overflow-hidden p-3">
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <Icon name="youtube" size={16} className="text-rose-400" />
              <span className="truncate text-[13px] font-semibold text-white">{set.source.title}</span>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${set.source.videoId}`}
                title={set.source.title}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/7 px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                {set.source.origin === "transcribed"
                  ? "Lecture transcript"
                  : set.source.origin === "extracted"
                    ? "Extracted text"
                    : "Source material"}
              </h3>
              {set.source.fileName && <span className="chip !py-0.5 !text-[10px]">{set.source.fileName}</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Icon name="search" size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="input !w-44 !py-1.5 !pl-8 !text-[12px]"
                  placeholder="Search source…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button className="btn btn-quiet !px-2 !py-1.5" title="Copy source" onClick={() => copyText(set.text).then((ok) => toast(ok ? "Source copied" : "Copy failed", ok ? "success" : "error"))}>
                <Icon name="copy" size={13} />
              </button>
              <button
                className={`btn ${editing ? "btn-primary" : "btn-ghost"} !px-2.5 !py-1.5 text-[12px]`}
                onClick={() => {
                  if (editing && draft !== set.text) {
                    updateSet(set.id, { text: draft });
                    toast("Source updated — regenerate to rebuild the study materials", "success");
                  }
                  setEditing((e) => !e);
                }}
              >
                <Icon name={editing ? "check" : "edit"} size={13} />
                {editing ? "Save" : "Edit"}
              </button>
            </div>
          </div>

          {editing ? (
            <textarea
              className="min-h-[32rem] w-full resize-y bg-transparent p-4 font-mono text-[12.5px] leading-relaxed text-slate-300 outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <div className="max-h-[38rem] overflow-y-auto p-4">
              {query.trim() && (
                <p className="mb-3 text-[11.5px] text-slate-500">
                  {matches} match{matches === 1 ? "" : "es"} for “{query}”
                </p>
              )}
              {highlighted.split(/[\u0000\u0001]/).map((chunk, idx) =>
                idx % 2 === 1 ? (
                  <mark key={idx} className="rounded bg-accent-400/28 px-0.5 text-accent-200">
                    {chunk}
                  </mark>
                ) : (
                  <span key={idx} className="whitespace-pre-wrap font-mono text-[12.5px] leading-[1.85] text-slate-400">
                    {chunk}
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <div className="panel p-4">
          <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Source stats</h3>
          <dl className="flex flex-col gap-1.5 text-[12.5px]">
            <StatRow label="Words" value={stats.words.toLocaleString()} />
            <StatRow label="Reading time" value={`${stats.minutes} min`} />
            <StatRow label="Sentences" value={String(stats.sentences)} />
            <StatRow label="Concepts detected" value={String(stats.terms)} />
            <StatRow label="Input type" value={set.source.kind} />
          </dl>
        </div>

        <div className="panel p-4 text-[12px] leading-relaxed text-slate-400">
          <Icon name="info" size={14} className="mb-1.5 text-slate-600" />
          Everything in this study set — notes, cards, quiz, podcast and tutor answers — is derived from the text on
          this page. Edit it, then hit <span className="font-semibold text-slate-200">Regenerate</span> to rebuild.
        </div>
      </aside>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate font-semibold capitalize text-slate-200">{value}</dd>
    </div>
  );
}
