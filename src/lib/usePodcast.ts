"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PodcastLine } from "@/lib/types";

export interface PodcastState {
  supported: boolean;
  playing: boolean;
  paused: boolean;
  index: number;
  rate: number;
  total: number;
  finished: boolean;
  play: (from?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (i: number) => void;
  setRate: (r: number) => void;
  speakerNames: { A: string; B: string };
}

const NAMES = { A: "Nova", B: "Miles" };

/**
 * Plays a generated podcast script with the browser's speech synthesis,
 * casting two different voices for the two hosts.
 */
export function usePodcast(lines: PodcastLine[]): PodcastState {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [rate, setRateState] = useState(1);
  const [finished, setFinished] = useState(false);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const idxRef = useRef(0);
  const playingRef = useRef(false);
  const rateRef = useRef(1);

  idxRef.current = index;
  rateRef.current = rate;

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", load);
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    };
  }, [supported]);

  const pickVoice = useCallback((speaker: "A" | "B") => {
    const voices = voicesRef.current;
    if (!voices.length) return null;
    const english = voices.filter((v) => /^en/i.test(v.lang));
    const pool = english.length ? english : voices;
    const natural = pool.filter((v) => !/google|whisper/i.test(v.name));
    const list = natural.length >= 2 ? natural : pool;
    const i = speaker === "A" ? 0 : 1 % list.length;
    return list[i] ?? pool[0];
  }, []);

  const speakAt = useCallback(
    (i: number) => {
      if (!supported) return;
      if (i >= lines.length) {
        playingRef.current = false;
        setPlaying(false);
        setPaused(false);
        setFinished(true);
        return;
      }
      const line = lines[i];
      const u = new SpeechSynthesisUtterance(line.text);
      const v = pickVoice(line.speaker);
      if (v) u.voice = v;
      u.rate = rateRef.current;
      u.pitch = line.speaker === "A" ? 1.06 : 0.88;
      u.volume = 1;
      u.onend = () => {
        if (!playingRef.current) return;
        const next = i + 1;
        setIndex(next);
        speakAt(next);
      };
      u.onerror = () => {
        if (!playingRef.current) return;
        const next = i + 1;
        setIndex(next);
        speakAt(next);
      };
      window.speechSynthesis.speak(u);
    },
    [lines, pickVoice, supported]
  );

  const play = useCallback(
    (from = 0) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      playingRef.current = true;
      setPlaying(true);
      setPaused(false);
      setFinished(false);
      setIndex(from);
      speakAt(from);
    },
    [speakAt, supported]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    playingRef.current = false;
    setPlaying(false);
    setPaused(true);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      playingRef.current = true;
      setPlaying(true);
      setPaused(false);
      return;
    }
    play(idxRef.current);
  }, [play, supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    playingRef.current = false;
    window.speechSynthesis.cancel();
    setPlaying(false);
    setPaused(false);
    setIndex(0);
  }, [supported]);

  const seek = useCallback(
    (i: number) => {
      if (!supported) return;
      const target = Math.max(0, Math.min(lines.length - 1, i));
      if (playingRef.current) play(target);
      else {
        window.speechSynthesis.cancel();
        setIndex(target);
        setFinished(false);
      }
    },
    [lines.length, play, supported]
  );

  const setRate = useCallback(
    (r: number) => {
      setRateState(r);
      rateRef.current = r;
      if (playingRef.current) play(idxRef.current);
    },
    [play]
  );

  useEffect(() => () => {
    playingRef.current = false;
    try {
      if (supported) window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
  }, [supported]);

  return useMemo(
    () => ({
      supported,
      playing,
      paused,
      index,
      rate,
      total: lines.length,
      finished,
      play,
      pause,
      resume,
      stop,
      seek,
      setRate,
      speakerNames: NAMES,
    }),
    [supported, playing, paused, index, rate, lines.length, finished, play, pause, resume, stop, seek, setRate]
  );
}
