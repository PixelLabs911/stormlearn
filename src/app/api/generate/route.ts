import { NextResponse } from "next/server";
import type { GenerateRequest, GenerateResult } from "@/lib/types";
import { chatJSON, LLMError, providerReady, truncate } from "@/lib/llm";
import { GEN_SYSTEM, genUserPrompt, normalizeContent } from "@/lib/prompts";
import { generateFromText } from "@/lib/demo-engine";
import { clamp } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body?.text || "").trim();
  const title = (body?.title || "Untitled study set").trim().slice(0, 140);
  if (text.length < 60) {
    return NextResponse.json(
      { error: "Add a bit more source material — at least a few sentences are needed to build study sets." },
      { status: 400 }
    );
  }

  const options = body.options || {};
  const cards = clamp(options.cards ?? 14, 4, 40);
  const questions = clamp(options.questions ?? 8, 3, 20);
  const difficulty = options.difficulty || "mixed";
  const warnings: string[] = [];

  const settings = body.settings;

  if (providerReady(settings)) {
    try {
      const raw = await chatJSON<any>({
        settings,
        system: GEN_SYSTEM,
        user: genUserPrompt({
          title,
          text: truncate(text, 46_000),
          cards,
          questions,
          difficulty,
        }),
        maxTokens: 6000,
        temperature: 0.35,
        timeoutMs: 110_000,
      });
      const content = normalizeContent(raw, title);

      // Top up anything the model skipped so the UI never shows an empty tab.
      if (content.flashcards.length < 3 || content.questions.length < 3 || content.podcast.length < 4) {
        const demo = generateFromText(text, { title, cards, questions, difficulty });
        if (content.flashcards.length < 3) content.flashcards = demo.flashcards;
        if (content.questions.length < 3) content.questions = demo.questions;
        if (content.podcast.length < 4) {
          content.podcast = demo.podcast;
          content.podcastTitle = demo.podcastTitle;
        }
        if (!content.sections.length) content.sections = demo.sections;
        if (!content.keyTerms.length) content.keyTerms = demo.keyTerms;
        warnings.push("Some sections were completed with the built-in engine.");
      }

      const result: GenerateResult = { content, engine: "llm", model: settings.model, warnings };
      return NextResponse.json(result);
    } catch (err) {
      const message =
        err instanceof LLMError ? err.message : err instanceof Error ? err.message : "Unknown model error";
      warnings.push(`AI provider failed (${message}). Generated with the built-in engine instead.`);
    }
  }

  const content = generateFromText(text, { title, cards, questions, difficulty });
  const result: GenerateResult = { content, engine: "demo", warnings };
  return NextResponse.json(result);
}
