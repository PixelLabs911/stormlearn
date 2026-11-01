"use client";

import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { extractText } from "@/lib/extract";
import { toast } from "@/lib/toast";
import type { SourceKind } from "@/lib/types";

export interface PickedFile {
  name: string;
  kind: SourceKind;
  text: string;
  size: number;
}

interface Props {
  onFile: (file: PickedFile) => void;
  audioApiKey: string;
}

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.csv,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.mp4,.mov";

function kindFor(name: string, mime: string): SourceKind {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx") || n.endsWith(".doc")) return "docx";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "text";
}

export function FileDrop({ onFile, audioApiKey }: Props) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const kind = kindFor(file.name, file.type);

      if (kind === "audio" || kind === "video") {
        if (!audioApiKey) {
          toast(
            "Audio needs an OpenAI key for transcription (Settings). Or use the Record tab for live in-browser transcription.",
            "error"
          );
          return;
        }
        setAudioBusy(true);
        try {
          const form = new FormData();
          form.append("file", file);
          form.append("apiKey", audioApiKey);
          form.append("model", "whisper-1");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.text) throw new Error(data?.error || "Transcription failed.");
          onFile({
            name: file.name,
            kind: "audio",
            text: data.transcript || data.text,
            size: file.size,
          });
          toast(`Transcribed ${file.name}`, "success");
        } catch (err: any) {
          toast(err?.message || "Transcription failed.", "error");
        } finally {
          setAudioBusy(false);
        }
        return;
      }

      setBusy(file.name);
      try {
        const { text } = await extractText(file);
        const clean = (text || "").trim();
        if (clean.length < 40) {
          throw new Error("Not enough readable text in that file.");
        }
        onFile({ name: file.name, kind, text: clean, size: file.size });
        toast(`Read ${file.name} · ${clean.split(/\s+/).length} words`, "success");
      } catch (err: any) {
        toast(err?.message || `Couldn't read ${file.name}`, "error");
      } finally {
        setBusy(null);
      }
    },
    [audioApiKey, onFile]
  );

  const busyAny = !!busy || audioBusy;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={`panel relative grid place-items-center px-6 py-11 text-center transition ${
          over ? "border-brand-400/50 bg-brand-500/8" : ""
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />

        {busyAny ? (
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-sm font-semibold text-slate-200">
              {audioBusy ? "Transcribing audio…" : `Reading ${busy}…`}
            </p>
            <p className="max-w-sm text-xs text-slate-500">
              {audioBusy
                ? "Large recordings can take a minute."
                : "Extracting text happens right here in your browser — the file is never uploaded."}
            </p>
          </div>
        ) : (
          <>
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-white/18 bg-white/4 text-slate-400">
              <Icon name="upload" size={22} />
            </span>
            <p className="font-bold text-white">Drop files here</p>
            <p className="mt-1 text-[13px] text-slate-400">PDFs, Word docs, slides, notes and audio recordings</p>
            <button type="button" className="btn btn-ghost mt-4" onClick={() => inputRef.current?.click()}>
              <Icon name="file" size={15} />
              Choose a file
            </button>
            <p className="mt-3 text-[11px] text-slate-600">{ACCEPT.replaceAll(".", "").replaceAll(",", " · ")}</p>
          </>
        )}
      </div>

      {!audioApiKey && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-white/7 bg-white/2 px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-400">
          <Icon name="info" size={14} className="mt-0.5 shrink-0 text-accent-300" />
          <span>
            Audio uploads are transcribed with OpenAI Whisper — add a key in{" "}
            <a href="/settings" className="font-semibold text-brand-300 underline underline-offset-2">Settings</a>, or
            use <span className="font-semibold text-slate-200">Record</span> for free in-browser transcription.
          </span>
        </p>
      )}
    </div>
  );
}

export function Spinner({ size = 26 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-white/15 border-t-brand-400"
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}
