/**
 * llm.ts — provider-agnostic chat/JSON client used by the API routes.
 * No SDKs: plain fetch so the dependency footprint stays tiny.
 */

import type { Provider, Settings } from "./types";

export class LLMError extends Error {
  status?: number;
  provider: Provider;
  constructor(message: string, provider: Provider, status?: number) {
    super(message);
    this.name = "LLMError";
    this.provider = provider;
    this.status = status;
  }
}

export function providerReady(settings?: Settings | null): settings is Settings {
  if (!settings) return false;
  if (!settings.provider || settings.provider === "demo") return false;
  return typeof settings.apiKey === "string" && settings.apiKey.trim().length > 8;
}

interface ChatArgs {
  settings: Settings;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export async function chat({
  settings,
  system,
  user,
  maxTokens = 3500,
  temperature = 0.4,
  timeoutMs = 60_000,
}: ChatArgs): Promise<string> {
  const key = settings.apiKey.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (settings.provider === "openai") {
      const model = settings.model || "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new LLMError(readError(data, `OpenAI request failed (${res.status})`), "openai", res.status);
      return data?.choices?.[0]?.message?.content ?? "";
    }

    if (settings.provider === "anthropic") {
      const model = settings.model || "claude-sonnet-4-5";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new LLMError(readError(data, `Anthropic request failed (${res.status})`), "anthropic", res.status);
      const blocks = data?.content ?? [];
      return blocks
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("\n");
    }

    if (settings.provider === "google") {
      const model = settings.model || "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new LLMError(readError(data, `Gemini request failed (${res.status})`), "google", res.status);
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      return parts.map((p: any) => p?.text ?? "").join("\n");
    }

    throw new LLMError("No AI provider configured.", settings.provider ?? "demo");
  } catch (err: any) {
    if (err instanceof LLMError) throw err;
    if (err?.name === "AbortError") throw new LLMError("The model took too long to respond.", settings.provider, 408);
    throw new LLMError(err?.message || "Network error while contacting the model provider.", settings.provider);
  } finally {
    clearTimeout(timer);
  }
}

function readError(data: any, fallback: string): string {
  return (
    data?.error?.message ||
    data?.message ||
    (Array.isArray(data?.error?.errors) && data.error.errors[0]?.message) ||
    fallback
  );
}

/** Ask a model for JSON and parse it defensively. */
export async function chatJSON<T>(args: ChatArgs): Promise<T> {
  const raw = await chat({
    ...args,
    system: `${args.system}\n\nRespond with ONLY valid minified JSON. No prose, no markdown fences.`,
  });
  return parseJSON<T>(raw);
}

export function parseJSON<T>(raw: string): T {
  const text = (raw || "").trim();
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // find the outermost {...} or [...] block
    const firstObj = cleaned.indexOf("{");
    const firstArr = cleaned.indexOf("[");
    const start =
      firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
    if (start >= 0) {
      const open = cleaned[start];
      const close = open === "{" ? "}" : "]";
      const end = cleaned.lastIndexOf(close);
      if (end > start) {
        const slice = cleaned.slice(start, end + 1);
        try {
          return JSON.parse(slice) as T;
        } catch {
          /* fall through */
        }
      }
    }
    throw new LLMError("The model returned JSON I could not parse.", "demo");
  }
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[...source truncated...]`;
}
