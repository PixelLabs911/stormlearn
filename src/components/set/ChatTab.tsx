"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { ChatMessage, StudySet } from "@/lib/types";
import { copyText, renderMarkdown, uid } from "@/lib/utils";

const SUGGESTIONS = [
  "Summarise this in five bullet points I could revise from",
  "What are the three most examinable ideas here?",
  "Explain the hardest concept like I'm 15",
  "Quiz me — ask one question at a time and mark my answers",
  "What's likely to confuse people about this topic?",
  "Turn the key numbers and dates into a memory trick",
];

export function ChatTab({ set }: { set: StudySet }) {
  const { settings, llmActive } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid("msg"),
      role: "assistant",
      content: `I'm your tutor for **${set.title}**. I answer from the ${
        set.source.kind === "youtube" ? "video captions" : set.source.kind === "audio" ? "lecture transcript" : "source material"
      } you built this set from — ${
        set.content.keyTerms.length
          ? `ask me about ${set.content.keyTerms.slice(0, 3).map((t) => `**${t.term}**`).join(", ")} or anything else in here.`
          : "ask me anything about it."
      }`,
      at: Date.now(),
      engine: set.engine,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const contextTerms = useMemo(
    () => set.content.keyTerms.slice(0, 8).map((t) => t.term),
    [set.content.keyTerms]
  );

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    if (!set.text.trim()) {
      toast("This study set has no source text to ground answers in.", "error");
      return;
    }

    const userMsg: ChatMessage = { id: uid("msg"), role: "user", content: question, at: Date.now() };
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: set.title,
          text: set.text,
          question,
          messages: history,
          settings: llmActive ? settings : undefined,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "The tutor couldn't answer that.");

      setMessages((prev) => [
        ...prev,
        {
          id: uid("msg"),
          role: "assistant",
          content: data.answer,
          citations: data.citations || [],
          engine: data.engine,
          at: Date.now(),
        },
      ]);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: uid("msg"),
            role: "assistant",
            content: `⚠️ ${err?.message || "Something went wrong."}`,
            at: Date.now(),
            engine: "demo",
          },
        ]);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16.5rem]">
      <div className="panel flex min-h-[34rem] flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/7 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-punch-500 text-white">
              <Icon name="brain" size={15} />
            </span>
            <div>
              <p className="text-[13px] font-bold leading-none text-white">AI tutor</p>
              <p className="mt-1 text-[10.5px] text-slate-500">
                Grounded in {set.text.split(/\s+/).length.toLocaleString()} words of your source
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`chip !py-0.5 !text-[10px] ${llmActive ? "!border-emerald-400/30 !text-emerald-300" : "!border-accent-400/30 !text-accent-300"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${llmActive ? "bg-emerald-400" : "bg-accent-400"}`} />
              {llmActive ? "LLM" : "extractive"}
            </span>
            <button
              className="btn btn-quiet !px-2 !py-1"
              title="Clear conversation"
              onClick={() => setMessages((prev) => [prev[0]])}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3.5">
            {messages.map((m) => (
              <Message key={m.id} m={m} onCopy={() => copyText(m.content).then((ok) => toast(ok ? "Copied" : "Copy failed", ok ? "success" : "error"))} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md border border-white/8 bg-white/3 px-4 py-3">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-300"
                    style={{ animationDelay: `${d * 0.13}s` }}
                  />
                ))}
                <span className="ml-1 text-[12px] text-slate-500">Reading your source…</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/7 p-3">
          <div className="flex items-end gap-2">
            <textarea
              className="input max-h-40 min-h-[2.9rem] resize-none"
              rows={1}
              placeholder="Ask about anything in this study set…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            {busy ? (
              <button className="btn btn-danger !px-3.5" onClick={() => abortRef.current?.abort()} title="Stop">
                <Icon name="stop" size={14} />
              </button>
            ) : (
              <button className="btn btn-primary !px-3.5" onClick={() => send()} disabled={!input.trim()} title="Send">
                <Icon name="send" size={15} />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[10.5px] text-slate-600">
            Enter to send · Shift+Enter for a new line · answers stay inside your material
          </p>
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <div className="panel p-4">
          <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Try asking</h3>
          <div className="flex flex-col gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={busy}
                className="rounded-lg border border-white/7 bg-white/2 px-3 py-2 text-left text-[12px] leading-snug text-slate-300 transition hover:border-brand-400/35 hover:bg-brand-500/8 hover:text-white disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {contextTerms.length > 0 && (
          <div className="panel p-4">
            <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Jump to a concept</h3>
            <div className="flex flex-wrap gap-1.5">
              {contextTerms.map((t) => (
                <button key={t} className="chip !cursor-pointer hover:!bg-white/9" onClick={() => send(`What is ${t} and why does it matter here?`)} disabled={busy}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {!llmActive && (
          <a href="/settings" className="panel flex items-start gap-2.5 p-4 transition hover:border-brand-400/35 hover:bg-white/5">
            <Icon name="sparkle" size={15} className="mt-0.5 shrink-0 text-accent-300" />
            <span className="text-[12px] leading-relaxed text-slate-400">
              <span className="font-semibold text-slate-200">Unlock conversational answers.</span> The tutor currently
              quotes the most relevant lines from your source. Add an OpenAI, Anthropic or Gemini key for real reasoning.
            </span>
          </a>
        )}
      </aside>
    </div>
  );
}

function Message({ m, onCopy }: { m: ChatMessage; onCopy: () => void }) {
  const mine = m.role === "user";
  return (
    <div className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
      {!mine && (
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500/80 to-punch-500/80 text-white">
          <Icon name="bolt" size={13} />
        </span>
      )}
      <div className={`group min-w-0 max-w-[85%] ${mine ? "items-end" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
            mine
              ? "rounded-br-md bg-gradient-to-br from-brand-600 to-violet-600 text-white"
              : "rounded-bl-md border border-white/8 bg-white/3 text-slate-200"
          }`}
        >
          <div className="prose-notes !text-[13.5px] [&_h1]:text-base [&_h2]:text-[14px] [&_h3]:text-[13px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
        </div>

        {!mine && (m.citations?.length || m.content.length > 40) && (
          <div className="mt-1 flex items-center gap-2 px-1 text-[10.5px] text-slate-600">
            {m.engine && (
              <span className={`rounded px-1.5 py-0.5 font-bold uppercase tracking-wide ${m.engine === "llm" ? "bg-emerald-500/12 text-emerald-300" : "bg-white/5 text-slate-500"}`}>
                {m.engine === "llm" ? "model" : "source-grounded"}
              </span>
            )}
            <button className="opacity-0 transition group-hover:opacity-100 hover:text-slate-300" onClick={onCopy}>
              <Icon name="copy" size={12} />
            </button>
          </div>
        )}

        {!!m.citations?.length && (
          <div className="mt-1.5 flex flex-col gap-1">
            {m.citations.slice(0, 3).map((c, idx) => (
              <p key={idx} className="rounded-lg border-l-2 border-brand-400/35 bg-white/2 px-3 py-1.5 text-[11.5px] italic leading-snug text-slate-500">
                {c}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
