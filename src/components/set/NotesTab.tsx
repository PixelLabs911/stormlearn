"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { StudySet } from "@/lib/types";
import { copyText, renderMarkdown } from "@/lib/utils";

type AIAction = "simplify" | "expand" | "explain" | "bullets";

export function NotesTab({ set }: { set: StudySet }) {
  const { updateSet, settings, llmActive } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(set.content.notesMarkdown);
  const [saved, setSaved] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => setDraft(set.content.notesMarkdown), [set.content.notesMarkdown]);

  const persist = useCallback(
    (md: string) => {
      updateSet(set.id, (s) => ({ content: { ...s.content, notesMarkdown: md } }));
      setSaved(true);
    },
    [set.id, updateSet]
  );

  const onChange = (md: string) => {
    setDraft(md);
    setSaved(false);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => persist(md), 700);
  };

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  const exec = (cmd: string, arg?: string) => {
    previewRef.current?.focus();
    document.execCommand(cmd, false, arg);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const md = htmlToMarkdown(previewRef.current?.innerHTML || "");
      setDraft(md);
      persist(md);
    }, 500);
  };

  const ai = async (action: AIAction) => {
    const selection = (window.getSelection()?.toString() || "").trim();
    if (!selection) {
      toast("Select a sentence or paragraph in the notes first.", "info");
      return;
    }
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, selection, context: set.text, settings: llmActive ? settings : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Rewrite failed.");
      if (data.warning) toast(data.warning, "info");

      if (action === "explain") {
        const md = `${draft}\n\n## Explanation — “${selection.slice(0, 48)}${selection.length > 48 ? "…" : ""}”\n\n${data.text}\n`;
        setDraft(md);
        persist(md);
      } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const node = document.createTextNode(data.text);
          range.insertNode(node);
          sel.removeAllRanges();
        }
        const md = htmlToMarkdown(previewRef.current?.innerHTML || "");
        setDraft(md);
        persist(md);
      }
      toast(action === "explain" ? "Explanation added at the bottom" : "Selection rewritten", "success");
    } catch (err: any) {
      toast(err?.message || "Rewrite failed.", "error");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0">
        {/* summary + key terms */}
        <div className="panel mb-4 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <Icon name="sparkle" size={12} className="text-brand-300" /> Summary
          </div>
          <p
            className="text-[13.5px] leading-relaxed text-slate-300"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(set.content.summary) }}
          />
          {set.content.keyTerms.length > 0 && (
            <div className="mt-3.5 border-t border-white/7 pt-3.5">
              <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Key terms</div>
              <div className="flex flex-wrap gap-1.5">
                {set.content.keyTerms.slice(0, 14).map((t) => (
                  <span key={t.term} className="chip !text-[11px]" title={t.definition}>
                    <Icon name="brain" size={11} className="text-punch-400" />
                    {t.term}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* toolbar */}
        <div className="panel mb-3 flex flex-wrap items-center gap-1 p-2">
          <div className="flex items-center gap-0.5">
            <ToolBtn label="Bold" onClick={() => (editing ? wrap("**") : exec("bold"))} icon="𝐁" />
            <ToolBtn label="Italic" onClick={() => (editing ? wrap("_") : exec("italic"))} icon="𝘐" />
            <ToolBtn label="Heading" onClick={() => (editing ? prefixLine("### ") : exec("formatBlock", "<h3>"))} icon="H" />
            <ToolBtn label="Bullet list" onClick={() => (editing ? prefixLine("- ") : exec("insertUnorderedList"))} icon="•" />
            <ToolBtn label="Highlight" onClick={() => (editing ? wrap("`") : exec("hiliteColor", "#3b2f6b"))} icon="▨" />
          </div>

          <span className="mx-1 h-5 w-px bg-white/10" />

          <div className="flex items-center gap-0.5">
            {(["simplify", "expand", "explain", "bullets"] as AIAction[]).map((a) => (
              <button key={a} className="btn btn-quiet !px-2 !py-1.5 text-[11.5px] capitalize" onClick={() => ai(a)} title={`AI: ${a} selection`}>
                <Icon name="sparkle" size={12} className="text-punch-400" />
                {a}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span className={`text-[11px] font-semibold ${saved ? "text-slate-600" : "text-accent-300"}`}>
              {saved ? "Saved" : "Saving…"}
            </span>
            <button className="btn btn-quiet !px-2 !py-1.5" title="Copy markdown" onClick={() => copyText(draft).then((ok) => toast(ok ? "Notes copied" : "Copy failed", ok ? "success" : "error"))}>
              <Icon name="copy" size={14} />
            </button>
            <button
              className={`btn ${editing ? "btn-primary" : "btn-ghost"} !px-2.5 !py-1.5 text-[12px]`}
              onClick={() => {
                if (editing) persist(draft);
                setEditing((e) => !e);
              }}
            >
              <Icon name={editing ? "eye" : "edit"} size={14} />
              {editing ? "Preview" : "Edit"}
            </button>
          </div>
        </div>

        {/* notes body */}
        {editing ? (
          <textarea
            ref={areaRef}
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className="input min-h-[36rem] resize-y font-mono !text-[13px] leading-relaxed"
          />
        ) : (
          <div
            ref={previewRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              setSaved(false);
              if (saveTimer.current) window.clearTimeout(saveTimer.current);
              saveTimer.current = window.setTimeout(() => {
                const md = htmlToMarkdown(previewRef.current?.innerHTML || "");
                setDraft(md);
                persist(md);
              }, 700);
            }}
            className="prose-notes panel min-h-[36rem] cursor-text p-6"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) }}
          />
        )}

        <p className="mt-2 text-[11.5px] text-slate-600">
          Click anywhere in the notes to edit — select text and use <span className="font-semibold text-slate-400">simplify / expand / explain</span> to have the AI work on it.
        </p>
      </div>

      {/* right rail */}
      <aside className="flex flex-col gap-4">
        {set.content.outline.length > 0 && (
          <div className="panel p-4">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
              <Icon name="layers" size={12} /> Outline
            </h3>
            <ol className="flex flex-col gap-1.5">
              {set.content.outline.slice(0, 10).map((o, i) => (
                <li key={`${o}-${i}`} className="flex gap-2 text-[12.5px] leading-snug text-slate-400">
                  <span className="mt-px shrink-0 font-mono text-[10.5px] font-bold text-slate-600">{String(i + 1).padStart(2, "0")}</span>
                  <span>{o}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {set.content.facts.length > 0 && (
          <div className="panel p-4">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
              <Icon name="target" size={12} /> Memorise these
            </h3>
            <ul className="flex flex-col gap-2">
              {set.content.facts.slice(0, 6).map((f, i) => (
                <li key={i} className="rounded-lg border border-accent-400/15 bg-accent-400/6 px-3 py-2 text-[12px] leading-snug text-amber-100/90">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {set.content.sections.length > 0 && (
          <div className="panel p-4">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
              <Icon name="notes" size={12} /> Sections
            </h3>
            <ul className="flex flex-col gap-1">
              {set.content.sections.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-[12.5px] text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <span className="truncate">{s.heading}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );

  function wrap(token: string) {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e) || "text";
    const next = `${value.slice(0, s)}${token}${sel}${token}${value.slice(e)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length + sel.length);
    });
  }

  function prefixLine(prefix: string) {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart: s, value } = el;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, s + prefix.length);
    });
  }
}

function ToolBtn({ label, onClick, icon }: { label: string; onClick: () => void; icon: string }) {
  return (
    <button
      className="grid h-8 w-8 place-items-center rounded-lg text-[13px] font-bold text-slate-400 transition hover:bg-white/8 hover:text-white"
      onClick={onClick}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}

/** Best-effort HTML -> markdown so rich editing and raw markdown stay in sync. */
function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(walk).join("");
    switch (tag) {
      case "h1": return `\n# ${inner.trim()}\n\n`;
      case "h2": return `\n## ${inner.trim()}\n\n`;
      case "h3": return `\n### ${inner.trim()}\n\n`;
      case "h4": return `\n#### ${inner.trim()}\n\n`;
      case "strong":
      case "b": return `**${inner.trim()}**`;
      case "em":
      case "i": return `*${inner.trim()}*`;
      case "code": return `\`${inner}\``;
      case "br": return "\n";
      case "hr": return "\n---\n\n";
      case "p": return `${inner.trim()}\n\n`;
      case "div": return `${inner.trim()}\n`;
      case "ul":
        return `\n${Array.from(el.children).map((li) => `- ${walk(li).trim().replace(/\n+/g, " ")}`).join("\n")}\n\n`;
      case "ol":
        return `\n${Array.from(el.children).map((li, i) => `${i + 1}. ${walk(li).trim().replace(/\n+/g, " ")}`).join("\n")}\n\n`;
      case "li": return inner;
      default: return inner;
    }
  };
  return Array.from(doc.body.childNodes)
    .map(walk)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
