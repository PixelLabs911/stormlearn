export type SourceKind = "text" | "pdf" | "docx" | "audio" | "video" | "youtube";

export type EngineName = "demo" | "llm";

export type Provider = "demo" | "openai" | "anthropic" | "google";

export interface Settings {
  provider: Provider;
  apiKey: string;
  model: string;
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  demo: "",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.0-flash",
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  demo: "Built-in demo engine",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
};

export interface SourceMeta {
  kind: SourceKind;
  title: string;
  /** original file name, if any */
  fileName?: string;
  /** YouTube video id, if any */
  videoId?: string;
  /** duration in seconds (audio/video) */
  durationSec?: number;
  /** how the text was obtained */
  origin?: "pasted" | "extracted" | "transcribed" | "captions" | "typed";
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint?: string;
  tags: string[];
  /** spaced repetition state */
  srs: {
    box: number; // 1..5
    due: number; // epoch ms
    reps: number;
    lapses: number;
    lastGrade?: number;
  };
}

export type QuestionType = "mc" | "cloze" | "open";

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  answer: string;
  /** index into options for mc */
  answerIndex?: number;
  explanation: string;
  source?: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface PodcastLine {
  speaker: "A" | "B";
  text: string;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface NoteSection {
  heading: string;
  bullets: string[];
}

export interface GeneratedContent {
  summary: string;
  outline: string[];
  keyTerms: KeyTerm[];
  facts: string[];
  sections: NoteSection[];
  notesMarkdown: string;
  flashcards: Flashcard[];
  questions: Question[];
  podcast: PodcastLine[];
  podcastTitle: string;
}

export interface StudySet {
  id: string;
  title: string;
  subject: string;
  color: string;
  emoji: string;
  createdAt: number;
  updatedAt: number;
  source: SourceMeta;
  /** the extracted / pasted / transcribed text everything is derived from */
  text: string;
  transcript?: string;
  content: GeneratedContent;
  engine: EngineName;
  model?: string;
  stats: {
    cardsStudied: number;
    quizzesTaken: number;
    bestScore: number;
    podcastPlays: number;
    minutes: number;
  };
}

export interface GenerateOptions {
  cards?: number;
  questions?: number;
  includePodcast?: boolean;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
  language?: string;
}

export interface GenerateRequest {
  title: string;
  text: string;
  source: SourceMeta;
  options?: GenerateOptions;
  settings?: Settings;
}

export interface GenerateResult {
  content: GeneratedContent;
  engine: EngineName;
  model?: string;
  warnings: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  engine?: EngineName;
  at: number;
}
