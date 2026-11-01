import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_BYTES = 24 * 1024 * 1024; // Whisper API limit is 25 MB

/** Node 20's undici requires `purpose` on multipart Blob parts. */
function uploadBlob(buffer: Uint8Array, type: string, filename: string) {
  const Ctor = (globalThis as any).Blob as any;
  try {
    return new Ctor([buffer as any], { type, purpose: "user_data" });
  } catch {
    return new Ctor([buffer as any], { type });
  }
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }

  const file = form.get("file");
  const apiKey = String(form.get("apiKey") || "").trim();
  const model = String(form.get("model") || "whisper-1").trim() || "whisper-1";

  if (!(file instanceof File) && !(file && typeof file === "object" && "arrayBuffer" in (file as any))) {
    return NextResponse.json({ error: "No audio file received." }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Transcription needs an OpenAI API key (Settings → AI provider). Meanwhile you can record live with the in-browser notetaker, or paste a transcript.",
        needsKey: true,
      },
      { status: 400 }
    );
  }

  const blob = file as unknown as { arrayBuffer(): Promise<ArrayBuffer>; size: number; name: string; type: string };
  if (blob.size > MAX_BYTES) {
    return NextResponse.json({ error: "Audio file is larger than 24 MB. Split it or lower the recording quality." }, { status: 413 });
  }

  const buffer = new Uint8Array(await blob.arrayBuffer());
  const body = new FormData();
  body.append("file", uploadBlob(buffer, blob.type || "audio/mpeg", blob.name || "audio.mp3") as any);
  body.append("model", model);
  body.append("response_format", "verbose_json");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || `OpenAI transcription failed (${res.status}).` },
        { status: res.status }
      );
    }

    const text = String(data?.text || "").trim();
    const segments = Array.isArray(data?.segments)
      ? data.segments
          .filter((s: any) => typeof s?.text === "string")
          .map((s: any) => ({
            start: Math.round(Number(s.start) || 0),
            end: Math.round(Number(s.end) || 0),
            text: s.text.trim(),
          }))
      : [];

    const transcript = segments.length
      ? segments.map((s: any) => `[${fmt(s.start)}] ${s.text}`).join("\n")
      : text;

    return NextResponse.json({
      text,
      transcript,
      duration: Math.round(Number(data?.duration) || 0),
      language: data?.language || "en",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Could not reach the transcription service." },
      { status: 502 }
    );
  }
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
