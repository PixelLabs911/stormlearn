"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Settings, StudySet } from "@/lib/types";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  loadSets,
  markSeeded,
  saveSettings,
  saveSets,
  hasSeeded,
} from "@/lib/storage";

interface StoreValue {
  ready: boolean;
  sets: StudySet[];
  settings: Settings;
  llmActive: boolean;
  getSet: (id: string) => StudySet | undefined;
  addSet: (set: StudySet) => void;
  updateSet: (id: string, patch: Partial<StudySet> | ((s: StudySet) => Partial<StudySet>)) => void;
  removeSet: (id: string) => void;
  setSettings: (s: Settings) => void;
  subjects: string[];
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sets, setSets] = useState<StudySet[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const first = useRef(true);

  useEffect(() => {
    setSets(loadSets());
    setSettingsState(loadSettings());
    setReady(true);
    if (!hasSeeded()) markSeeded();
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveSets(sets);
  }, [sets, ready]);

  useEffect(() => {
    if (!ready) return;
    saveSettings(settings);
  }, [settings, ready]);

  useEffect(() => {
    first.current = false;
  }, []);

  const addSet = useCallback((set: StudySet) => {
    setSets((prev) => [set, ...prev]);
  }, []);

  const updateSet = useCallback(
    (id: string, patch: Partial<StudySet> | ((s: StudySet) => Partial<StudySet>)) => {
      setSets((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const p = typeof patch === "function" ? patch(s) : patch;
          return { ...s, ...p, updatedAt: Date.now() };
        })
      );
    },
    []
  );

  const removeSet = useCallback((id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const setSettings = useCallback((s: Settings) => setSettingsState(s), []);

  const getSet = useCallback((id: string) => sets.find((s) => s.id === id), [sets]);

  const subjects = useMemo(
    () => [...new Set(sets.map((s) => s.subject).filter(Boolean))].sort(),
    [sets]
  );

  const llmActive = settings.provider !== "demo" && settings.apiKey.trim().length > 8;

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      sets,
      settings,
      llmActive,
      getSet,
      addSet,
      updateSet,
      removeSet,
      setSettings,
      subjects,
    }),
    [ready, sets, settings, llmActive, getSet, addSet, updateSet, removeSet, setSettings, subjects]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
