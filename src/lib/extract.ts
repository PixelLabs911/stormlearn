/**
 * extract.ts — client-side text extraction for PDF / DOCX / TXT and helpers
 * for YouTube links. Everything runs in the browser so no file ever has to be
 * uploaded just to read it.
 */

export const MAX_CHARS = 400_000;

export async function extractText(file: File): Promise<{ text: string; note?: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return { text: await extractPdf(file) };
  if (name.endsWith(".docx")) return { text: await extractDocx(file) };
  if (name.endsWith(".doc")) {
    throw new Error("Legacy .doc files aren't supported — save as .docx or PDF and try again.");
  }
  if (name.endsWith(".pptx")) return { text: await extractPptx(file) };
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv") || file.type.startsWith("text/")) {
    const text = await file.text();
    return { text: clampText(text) };
  }
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
    throw new Error("AUDIO_FILE");
  }
  // last resort: try reading as text
  const text = await file.text();
  if (text && /[a-zA-Z]{3}/.test(text)) return { text: clampText(text) };
  throw new Error(`Couldn't read text from “${file.name}”.`);
}

function clampText(text: string): string {
  const clean = text.replace(/\r\n?/g, "\n").trim();
  return clean.length > MAX_CHARS ? clean.slice(0, MAX_CHARS) : clean;
}

/* ---------------------------------- PDF ---------------------------------- */

let pdfjsPromise: Promise<any> | null = null;

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // pdf.js 5.x uses Promise.withResolvers; polyfill for older browsers.
      if (typeof (Promise as any).withResolvers !== "function") {
        (Promise as any).withResolvers = function () {
          let resolve: any;
          let reject: any;
          const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
          });
          return { promise, resolve, reject };
        };
      }
      const pdfjs: any = await import("pdfjs-dist");
      const candidates = [
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs",
        "https://unpkg.com/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs",
      ];
      let ok = false;
      for (const url of candidates) {
        try {
          const res = await fetch(url, { method: "HEAD" });
          if (res.ok) {
            pdfjs.GlobalWorkerOptions.workerSrc = url;
            ok = true;
            break;
          }
        } catch {
          /* try next */
        }
      }
      if (!ok) {
        // Fake worker: runs on the main thread. Slower, but always available.
        try {
          await import("pdfjs-dist/build/pdf.worker.min.mjs");
        } catch {
          pdfjs.GlobalWorkerOptions.workerSrc = "";
        }
      }
      return pdfjs;
    })().catch((err) => {
      pdfjsPromise = null;
      throw err;
    });
  }
  return pdfjsPromise;
}

export async function extractPdf(file: File): Promise<string> {
  let pdfjs: any;
  try {
    pdfjs = await loadPdfJs();
  } catch {
    pdfjs = await import("pdfjs-dist").catch(() => null);
    if (!pdfjs) throw new Error("PDF support failed to load. Paste the text instead.");
  }
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({
    data: buf,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as any[]) {
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        lines.push(line);
        line = "";
      }
      line += item.str + (item.hasEOL ? "\n" : " ");
      lastY = y;
    }
    if (line) lines.push(line);
    const text = lines.join("\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
    if (text.trim()) pages.push(text.trim());
    page.cleanup?.();
  }
  const out = pages.join("\n\n").trim();
  if (!out) {
    throw new Error("That PDF has no selectable text (it may be a scan). Try pasting the text or an audio recording instead.");
  }
  return out.slice(0, MAX_CHARS);
}

/* --------------------------------- DOCX ---------------------------------- */

export async function extractDocx(file: File): Promise<string> {
  const xml = await readZipEntry(await file.arrayBuffer(), "word/document.xml");
  if (!xml) throw new Error("That .docx looks empty or corrupt.");
  return xmlToText(xml);
}

export async function extractPptx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const names = listZipEntries(buf).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  names.sort((a, b) => {
    const na = parseInt(a.match(/slide(\d+)/)?.[1] || "0", 10);
    const nb = parseInt(b.match(/slide(\d+)/)?.[1] || "0", 10);
    return na - nb;
  });
  const slides: string[] = [];
  for (const n of names) {
    const xml = await readZipEntry(buf, n);
    if (xml) slides.push(xmlToText(xml, "<a:p>"));
  }
  const out = slides.map((s, i) => `Slide ${i + 1}\n${s}`).join("\n\n").trim();
  if (!out) throw new Error("Couldn't read any slide text from that .pptx.");
  return out.slice(0, MAX_CHARS);
}

function xmlToText(xml: string, paragraphTag = "<w:p"): string {
  const paras = xml.split(new RegExp(paragraphTag.replace(/[<]/g, "\\<"), "i"));
  const out: string[] = [];
  for (const chunk of paras) {
    const text = chunk
      .replace(/<w:tab[^>]*\/>/gi, "\t")
      .replace(/<w:br[^>]*\/>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .trim();
    if (text) out.push(text);
  }
  return out.join("\n");
}

/* ------------------- minimal ZIP reader (stored + deflate) ---------------- */

function listZipEntries(buf: ArrayBuffer): string[] {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const names: string[] = [];
  for (let i = 0; i + 4 <= bytes.length; i++) {
    if (view.getUint32(i, true) === 0x04034b50) {
      const nameLen = view.getUint16(i + 26, true);
      const extraLen = view.getUint16(i + 28, true);
      const name = new TextDecoder().decode(bytes.slice(i + 30, i + 30 + nameLen));
      names.push(name);
      i += 30 + nameLen + extraLen - 1;
    }
  }
  return names;
}

async function readZipEntry(buf: ArrayBuffer, target: string): Promise<string | null> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const decoder = new TextDecoder("utf-8");

  for (let i = 0; i + 30 <= bytes.length; i++) {
    if (view.getUint32(i, true) !== 0x04034b50) continue;
    const method = view.getUint16(i + 8, true);
    const compSize = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    const name = decoder.decode(bytes.slice(i + 30, i + 30 + nameLen));
    const dataStart = i + 30 + nameLen + extraLen;
    if (name !== target) {
      i = dataStart + Math.max(0, compSize) - 1;
      continue;
    }
    const data = bytes.slice(dataStart, dataStart + compSize);
    if (method === 0) return decoder.decode(data);
    if (method === 8) {
      try {
        const ds = new DecompressionStream("deflate-raw");
        const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds);
        return await new Response(stream).text();
      } catch {
        return null;
      }
    }
    return null;
  }
  return null;
}

/* -------------------------------- YouTube -------------------------------- */

export function youtubeEmbedUrl(videoId: string) {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function youtubeThumb(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
