import { NextResponse } from "next/server";
import { chat, providerReady, truncate } from "@/lib/llm";
import { analyze } from "@/lib/demo-engine";
import { shortenLocal } from "@/lib/utils.server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  action: "simplify" | "expand" | "explain" | "bullets";
  selection: string;
  context?: string;
  settings?: any;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const selection = (body.selection || "").trim();
  const context = (body.context || "").trim();
  if (!selection) return NextResponse.json({ error: "Nothing selected." }, { status: 400 });

  const instructions: Record<Body["action"], string> = {
    simplify:
      "Rewrite the selected text so a first-year student understands it instantly. Plain words, short sentences, keep every technical term and number correct. Return only the rewritten text.",
    expand:
      "Expand the selected text with 2-4 extra sentences of detail drawn from the source material. Keep the same tone and format. Return only the expanded text.",
    explain:
      "Explain the selected text: what it means, why it matters, and one concrete example. Use markdown. Return only the explanation, starting with a bolded one-line answer.",
    bullets:
      "Convert the selected text into 3-6 tight markdown bullet points capturing every examinable fact. Return only the bullets.",
  };

  if (providerReady(body.settings)) {
    try {
      const out = await chat({
        settings: body.settings,
        system: `You are StormLearn's writing assistant working inside a student's notes.\n\nSOURCE MATERIAL FOR GROUNDING:\n"""\n${truncate(context, 18_000)}\n"""`,
        user: `${instructions[body.action] || instructions.explain}\n\nSELECTED TEXT:\n"""\n${selection}\n"""`,
        maxTokens: 900,
        temperature: 0.35,
        timeoutMs: 50_000,
      });
      return NextResponse.json({ text: out.trim(), engine: "llm" });
    } catch (err: any) {
      const local = localTransform(body.action, selection, context);
      return NextResponse.json({
        text: local,
        engine: "demo",
        warning: `AI provider failed (${err?.message || "unknown"}). Used the built-in editor instead.`,
      });
    }
  }

  return NextResponse.json({ text: localTransform(body.action, selection, context), engine: "demo" });
}

function localTransform(action: Body["action"], selection: string, context: string): string {
  const a = context ? analyze(context) : null;

  if (action === "simplify") {
    return selection
      .split(/(?<=[.!?])\s+/)
      .map((s) => shortenLocal(s, 150))
      .join(" ")
      .replace(/\b(utilise|utilise)\b/gi, "use")
      .replace(/\b(approximately)\b/gi, "about")
      .replace(/\b(subsequently)\b/gi, "then")
      .replace(/\b(demonstrates)\b/gi, "shows")
      .replace(/\b(thereof|therein|thereby)\b/gi, "");
  }

  if (action === "bullets") {
    const parts = selection
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12);
    return parts.map((p) => `- ${shortenLocal(p, 180)}`).join("\n");
  }

  const key = selection.split(/\s+/).slice(0, 6).join(" ");
  const related = a?.sentences
    .filter((s) => !s.text.includes(selection.slice(0, 40)))
    .map((s) => ({ s, hits: s.text.toLowerCase().split(/\W+/).filter((w) => key.toLowerCase().includes(w) && w.length > 4).length }))
    .filter((x) => x.hits > 0)
    .sort((x, y) => y.hits - x.hits)
    .slice(0, 3)
    .map((x) => shortenLocal(x.s.text, 200));

  if (action === "expand") {
    if (!related?.length) return `${selection.trim()} In other words, this is one of the ideas your material returns to most often — worth writing a one-line summary of it in your own words.`;
    return [selection.trim(), ...related].filter(Boolean).join(" ");
  }

  // explain
  const def = a?.definitions.find((d) => selection.toLowerCase().includes(d.term.toLowerCase()));
  const lines: string[] = [];
  lines.push(`**${def ? def.term : "In short"}:** ${def ? shortenLocal(def.meaning, 240) : shortenLocal(selection, 240)}`);
  if (related?.length) {
    lines.push("");
    lines.push("Elsewhere in your source material:");
    for (const r of related) lines.push(`- ${r}`);
  }
  lines.push("");
  lines.push("_Built-in explanation from your source. Add an AI provider in Settings for a fuller, conversational answer._");
  return lines.join("\n");
}
