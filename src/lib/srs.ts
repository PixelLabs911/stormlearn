/**
 * srs.ts — a small Leitner-style spaced repetition scheduler.
 * Grades: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy
 */

import type { Flashcard } from "./types";

export const GRADE_LABELS = ["Again", "Hard", "Good", "Easy"] as const;
export type Grade = 0 | 1 | 2 | 3;

const BOX_MINUTES = [1, 10, 60 * 24, 60 * 24 * 3, 60 * 24 * 7, 60 * 24 * 16];

export function freshCard(front: string, back: string, hint?: string, tags: string[] = []): Flashcard {
  return {
    id: `card_${Math.random().toString(36).slice(2, 9)}`,
    front,
    back,
    hint,
    tags,
    srs: { box: 1, due: Date.now(), reps: 0, lapses: 0 },
  };
}

export function gradeCard(card: Flashcard, grade: Grade): Flashcard {
  const box = card.srs.box;
  let next: number;
  if (grade === 0) next = 1;
  else if (grade === 1) next = Math.max(1, box);
  else if (grade === 2) next = Math.min(5, box + 1);
  else next = Math.min(5, box + 2);

  const minutes = BOX_MINUTES[next] ?? BOX_MINUTES[BOX_MINUTES.length - 1];
  const jitter = grade === 0 ? 0 : Math.random() * 0.15 * minutes;

  return {
    ...card,
    srs: {
      box: next,
      due: Date.now() + (minutes + jitter) * 60_000,
      reps: card.srs.reps + 1,
      lapses: card.srs.lapses + (grade === 0 ? 1 : 0),
      lastGrade: grade,
    },
  };
}

export function isDue(card: Flashcard, now = Date.now()): boolean {
  return card.srs.due <= now;
}

/** Build a study session: everything due first, then a slice of new cards. */
export function buildQueue(cards: Flashcard[], maxNew = 10, now = Date.now()): Flashcard[] {
  const due = cards.filter((c) => isDue(c, now) && c.srs.reps > 0);
  const fresh = cards.filter((c) => c.srs.reps === 0);
  const future = cards.filter((c) => !isDue(c, now) && c.srs.reps > 0);
  return [...shuffle(due), ...shuffle(fresh).slice(0, maxNew), ...future.slice(0, 3)];
}

function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function mastery(cards: Flashcard[]): number {
  if (!cards.length) return 0;
  const total = cards.reduce((sum, c) => sum + (c.srs.box - 1), 0);
  return Math.round((total / (cards.length * 4)) * 100);
}

export function dueCount(cards: Flashcard[], now = Date.now()): number {
  return cards.filter((c) => isDue(c, now)).length;
}
