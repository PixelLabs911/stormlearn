"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { formatDuration } from "@/lib/utils";
import { toast } from "@/lib/toast";

type SR = any;

function getRecognition(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  return rec;
}

interface Props {
  onText: (text: string) => void;
  text: string;
  setText: (t: string) => void;
}

/**
 * The AI Notetaker: live lecture transcription in the browser using the Web
 * Speech API. Timestamped lines land in the transcript so you can jump back.
 */
export function Recorder({ onText, text, setText }: Props) {
  const [supported] = useState(() => !!getRecognition());
  const [listening, setListening] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SR>(null);
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const finalRef = useRef(text);

  useEffect(() => {
    finalRef.current = text;
  }, [text]);

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    recRef.current = null;
    stopTimer();
    setListening(false);
    setInterim("");
  }, []);

  const stamp = useCallback(() => {
    const s = Math.floor((Date.now() - startRef.current) / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }, []);

  const start = useCallback(() => {
    const rec = getRecognition();
    if (!rec) {
      setError("Live transcription isn't available in this browser.");
      return;
    }
    setError(null);
    recRef.current = rec;
    startRef.current = Date.now() - elapsed * 1000;

    rec.onresult = (event: any) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const chunk = (res[0]?.transcript ?? "").trim();
        if (!chunk) continue;
        if (res.isFinal) {
          const base = finalRef.current.trim();
          const next = `${base}${base ? "\n" : ""}[${stamp()}] ${chunk}`;
          finalRef.current = next;
          setText(next);
          onText(next);
        } else {
          interimText += `${chunk} `;
        }
      }
      setInterim(interimText.trim());
    };

    rec.onerror = (e: any) => {
      const code = e?.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone access was blocked. Allow it in your browser's site settings and try again.");
        stop();
      } else if (code === "no-speech") {
        /* keep listening */
      } else if (code === "network") {
        setError("Browser speech service unreachable (common inside sandboxed previews). Use upload or paste instead.");
        stop();
      } else {
        setError(`Transcription stopped: ${code || "unknown error"}`);
        stop();
      }
    };

    rec.onend = () => {
      stopTimer();
      setListening(false);
      setInterim("");
      // Chrome ends the session periodically; restart while the user is recording.
      if (recRef.current === rec && finalRef.current.length >= 0 && (rec as any)._shouldRestart) {
        try {
          rec.start();
        } catch {
          /* noop */
        }
      }
    };

    try {
      rec.start();
      (rec as any)._shouldRestart = true;
      setListening(true);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 500);
    } catch {
      setError("Couldn't start the microphone. Check browser permissions.");
    }
  }, [elapsed, onText, setText, stamp, stop]);

  useEffect(() => () => {
    stopTimer();
    try {
      recRef.current?.abort?.();
    } catch {
      /* noop */
    }
  }, []);

  if (!supported) {
    return (
      <div className="panel p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-400/15 text-accent-300">
            <Icon name="info" size={17} />
          </span>
          <div>
            <h3 className="font-bold text-white">Live recording needs a Chromium browser</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
              This browser doesn't expose the Web Speech API, so in-browser lecture transcription is unavailable. You can
              still record with your phone or laptop recorder and upload the audio file (transcribed with an OpenAI key),
              or paste a transcript you already have.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/7 p-4">
        <button
          onClick={listening ? stop : start}
          className={`btn ${listening ? "btn-danger" : "btn-primary"} !rounded-full !px-4`}
        >
          <span className="relative grid h-6 w-6 place-items-center">
            {listening ? <Icon name="stop" size={13} /> : <Icon name="mic" size={15} />}
          </span>
          {listening ? "Stop recording" : "Start recording"}
        </button>

        <div className="flex items-center gap-2 font-mono text-sm tabular-nums text-slate-300">
          <Icon name="clock" size={14} className="text-slate-500" />
          {formatDuration(elapsed)}
        </div>

        <div className="flex h-7 flex-1 items-end justify-center gap-[3px]" aria-hidden>
          {Array.from({ length: 34 }).map((_, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full ${listening ? "bar bg-gradient-to-t from-brand-500 to-punch-400" : "bg-white/10"}`}
              style={{
                height: listening ? `${18 + ((i * 37) % 78)}%` : "22%",
                animationDelay: `${(i % 9) * 0.09}s`,
                animationDuration: `${0.75 + ((i % 5) * 0.12)}s`,
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className="btn btn-quiet !px-2 !py-1.5"
            title="Add a timestamp marker"
            onClick={() => {
              const base = finalRef.current.trim();
              const next = `${base}${base ? "\n" : ""}[${stamp()}] `;
              finalRef.current = next;
              setText(next);
              onText(next);
            }}
          >
            <Icon name="target" size={15} />
          </button>
          <button
            className="btn btn-quiet !px-2 !py-1.5"
            title="Clear transcript"
            onClick={() => {
              if (!text.trim()) return;
              if (!window.confirm("Clear the recorded transcript?")) return;
              finalRef.current = "";
              setText("");
              onText("");
              setElapsed(0);
            }}
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border-b border-rose-400/20 bg-rose-500/8 px-4 py-3 text-[12.5px] text-rose-200">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="p-4">
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Live transcript
        </label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onText(e.target.value);
          }}
          rows={9}
          spellCheck={false}
          placeholder={listening ? "Listening… speak or let the lecture run." : "Press start and the lecture appears here, timestamped as it goes. You can edit anything."}
          className="input resize-y font-mono !text-[12.5px] leading-relaxed"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate-500">
          <span>
            {text.trim() ? `${text.trim().split(/\s+/).length} words captured` : "Nothing captured yet"}
            {interim && <span className="ml-2 text-brand-300">· {interim.slice(0, 48)}…</span>}
          </span>
          <button
            className="btn btn-quiet !px-2 !py-1 text-[11px]"
            onClick={() => {
              navigator.clipboard?.writeText(text).then(
                () => toast("Transcript copied", "success"),
                () => toast("Couldn't copy", "error")
              );
            }}
            disabled={!text.trim()}
          >
            <Icon name="copy" size={13} /> Copy
          </button>
        </div>
      </div>
    </div>
  );
}
