import { NextResponse } from "next/server";
import { chat, LLMError, providerReady } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let settings: any;
  try {
    settings = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!providerReady(settings)) {
    return NextResponse.json({ ok: false, error: "Choose a provider and paste a valid API key first." }, { status: 400 });
  }

  try {
    const reply = await chat({
      settings,
      system: "You are a connection test. Reply with exactly: ok",
      user: "ping",
      maxTokens: 8,
      temperature: 0,
      timeoutMs: 20_000,
    });
    return NextResponse.json({ ok: true, reply: (reply || "").slice(0, 120), model: settings.model });
  } catch (err) {
    const message = err instanceof LLMError ? err.message : err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message, status: err instanceof LLMError ? err.status : undefined });
  }
}
