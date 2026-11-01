"use client";

import type { Settings, StudySet } from "./types";
import { DEFAULT_MODELS } from "./types";

const KEY_SETS = "stormlearn.sets.v1";
const KEY_SETTINGS = "stormlearn.settings.v1";
const KEY_ONBOARD = "stormlearn.seeded.v1";

export const DEFAULT_SETTINGS: Settings = {
  provider: "demo",
  apiKey: "",
  model: "",
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadSets(): StudySet[] {
  if (typeof window === "undefined") return [];
  const sets = safeParse<StudySet[]>(window.localStorage.getItem(KEY_SETS), []);
  return Array.isArray(sets) ? sets.map(migrate) : [];
}

export function saveSets(sets: StudySet[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_SETS, JSON.stringify(sets));
  } catch (err) {
    // Most likely quota exceeded: drop the largest source texts and retry once.
    try {
      const slim = sets.map((s) => ({
        ...s,
        text: s.text.slice(0, 60_000),
        transcript: s.transcript?.slice(0, 60_000),
      }));
      window.localStorage.setItem(KEY_SETS, JSON.stringify(slim));
    } catch {
      console.warn("Could not persist study sets", err);
    }
  }
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const s = safeParse<Partial<Settings>>(window.localStorage.getItem(KEY_SETTINGS), {});
  const provider = (s.provider ?? DEFAULT_SETTINGS.provider) as Settings["provider"];
  return {
    provider,
    apiKey: s.apiKey ?? "",
    model: s.model || DEFAULT_MODELS[provider] || "",
  };
}

export function saveSettings(settings: Settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function hasSeeded(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY_ONBOARD) === "1";
}

export function markSeeded() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_ONBOARD, "1");
  } catch {
    /* ignore */
  }
}

/** Forward-compatible shim so older saved sets never crash the UI. */
function migrate(s: any): StudySet {
  return {
    ...s,
    stats: {
      cardsStudied: 0,
      quizzesTaken: 0,
      bestScore: 0,
      podcastPlays: 0,
      minutes: 0,
      ...(s.stats || {}),
    },
    content: {
      summary: "",
      outline: [],
      keyTerms: [],
      facts: [],
      sections: [],
      notesMarkdown: "",
      flashcards: [],
      questions: [],
      podcast: [],
      podcastTitle: "",
      ...(s.content || {}),
    },
    source: { kind: "text", title: s?.title || "Untitled", ...(s.source || {}) },
  } as StudySet;
}
