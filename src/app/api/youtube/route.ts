import { NextResponse } from "next/server";
import { youtubeId } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 45;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&nbsp;/g, " ");
}

function parseTranscriptXml(xml: string): string {
  const parts: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const t = decodeEntities(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (t) parts.push(t);
  }
  return parts.join(" ");
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" } });
  if (!res.ok) return "";
  return res.text();
}

export async function POST(req: Request) {
  let body: { url: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = youtubeId(body?.url || "");
  if (!id) return NextResponse.json({ error: "That doesn't look like a YouTube link." }, { status: 400 });

  const warnings: string[] = [];
  let title = `YouTube video ${id}`;
  let transcript = "";

  try {
    const page = await fetchText(`https://www.youtube.com/watch?v=${id}&hl=en`);
    if (page) {
      const t = page.match(/<title>([^<]*)<\/title>/);
      if (t) title = decodeEntities(t[1]).replace(/\s*[-–]\s*YouTube\s*$/, "").trim() || title;

      const prMatch = page.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:var|<\/script>)/);
      const pr = prMatch ? prMatch[1] : null;
      if (pr) {
        try {
          const json = JSON.parse(pr);
          const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
          if (tracks.length) {
            const preferred =
              tracks.find((tr: any) => /^en/i.test(tr.languageCode) && !tr.kind) ||
              tracks.find((tr: any) => /^en/i.test(tr.languageCode)) ||
              tracks[0];
            const base = String(preferred.baseUrl || "");
            if (base) {
              transcript = parseTranscriptXml(await fetchText(`${base}&fmt=srv3`)) || parseTranscriptXml(await fetchText(base));
              if (!/^en/i.test(preferred.languageCode || "")) {
                warnings.push(`Captions were in ${preferred.languageCode}; consider pasting an English transcript.`);
              }
            }
          }
        } catch {
          warnings.push("Couldn't read the video's caption track list.");
        }
      }

      if (!transcript) {
        // Some layouts expose a timedtext endpoint directly.
        const direct = await fetchText(`https://www.youtube.com/api/timedtext?v=${id}&lang=en&fmt=srv3`);
        if (direct && /<text/.test(direct)) transcript = parseTranscriptXml(direct);
      }
    }
  } catch {
    warnings.push("YouTube could not be reached from the server.");
  }

  transcript = transcript.replace(/\s+/g, " ").trim();

  if (!transcript || transcript.length < 80) {
    return NextResponse.json({
      videoId: id,
      title,
      transcript: "",
      ok: false,
      error:
        "No captions available for that video (or YouTube blocked the request). Paste the transcript or a video link with captions enabled.",
      warnings,
    });
  }

  return NextResponse.json({ videoId: id, title, transcript: transcript.slice(0, 400_000), ok: true, warnings });
}
