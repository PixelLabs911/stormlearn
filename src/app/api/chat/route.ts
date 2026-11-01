import { NextResponse } from "next/server";
import { chat, LLMError, providerReady, truncate } from "@/lib/llm";
import { answerFromText } from "@/lib/demo-engine";
import { chatSystem, chatUserPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  title: string;
  text: string;
  question: string;
  messages?: { role: string; content: string }[];
  settings?: any;
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = (body.question || "").trim();
  const text = (body.text || "").trim();
  if (!question) return NextResponse.json({ error: "Empty question." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "This study set has no source text." }, { status: 400 });

  const history = (body.messages || []).filter((m) => m?.content).slice(-8);

  if (providerReady(body.settings)) {
    try {
      const messages = [
        ...history.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
        { role: "user", content: question },
      ];
      const answer = await chat({
        settings: body.settings,
        system: chatSystem(truncate(text, 24_000), body.title || "this study set"),
        user: chatUserPrompt(messages),
        maxTokens: 1200,
        temperature: 0.4,
        timeoutMs: 55_000,
      });
      return NextResponse.json({ answer: answer.trim(), engine: "llm", citations: [] });
    } catch (err) {
      const message =
        err instanceof LLMError ? err.message : err instanceof Error ? err.message : "Unknown model error";
      const fallback = answerFromText(text, question);
      return NextResponse.json({
        answer: `${fallback.answer}\n\n_(AI provider error: ${message} — showing the built-in extractive answer.)_`,
        engine: "demo",
        citations: fallback.citations,
      });
    }
  }

  const extracted = answerFromText(text, question);
  return NextResponse.json({
    answer: extracted.answer,
    engine: "demo",
    citations: extracted.citations,
  });
}
