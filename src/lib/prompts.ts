/** Prompts + normalisation for LLM-powered generation (server side). */

import type { Flashcard, GeneratedContent, PodcastLine, Question } from "./types";
import { uid } from "./utils";

export const GEN_SYSTEM = `You are StormLearn's study-material engine. You are given source material (a lecture transcript, PDF text, notes, or video captions) and you convert it into complete study materials.

Rules:
- Use ONLY information present in the source. Never invent facts, dates, or definitions.
- Write in clear, exam-focused language. Be specific: keep numbers, dates, names, formulas and terminology exactly as given.
- Clean up filler words from speech ("um", "so", "you know") but never drop technical content.
- Every flashcard must be self-contained and answerable without seeing the others.
- Quiz questions must be unambiguous with exactly one defensible answer. Wrong options must be plausible but clearly incorrect.
- The podcast is a two-host study show: warm, fast-paced, genuinely useful. Host A asks and quizzes, Host B explains. Every line must be speakable aloud (no bullet symbols, no markdown, no URLs).`;

export function genUserPrompt(input: {
  title: string;
  text: string;
  cards: number;
  questions: number;
  difficulty: string;
}): string {
  return `Create study materials for "${input.title}".

Produce exactly this JSON object:
{
  "summary": string,                     // 3-5 sentences, markdown bold allowed for key terms
  "outline": string[],                   // 4-10 short topic labels in the order they appear
  "keyTerms": [{"term": string, "definition": string}],   // 8-16 entries
  "facts": string[],                     // 3-8 specific numbers, dates, names, formulas worth memorising
  "sections": [{"heading": string, "bullets": string[]}], // 4-9 sections, 2-5 bullets each, bullets are full informative sentences
  "notesMarkdown": string,               // complete structured notes in markdown: H1 title, Summary, Key terms, Study notes with H2/H3 sections and bullets, Numbers & dates, Quick recall
  "flashcards": [{"front": string, "back": string, "hint": string, "tags": string[]}],
  "questions": [
     {"type":"mc","prompt":string,"options":string[4],"answer":string,"answerIndex":number,"explanation":string,"source":string,"difficulty":"easy"|"medium"|"hard"},
     {"type":"cloze","prompt":string,"answer":string,"explanation":string,"source":string,"difficulty":"easy"|"medium"|"hard"},
     {"type":"open","prompt":string,"answer":string,"explanation":string,"source":string,"difficulty":"easy"|"medium"|"hard"}
  ],
  "podcastTitle": string,
  "podcast": [{"speaker":"A"|"B","text":string}]   // 14-24 lines
}

Requirements:
- ${input.cards} flashcards. Mix definition cards, cloze (fill-in-the-blank) cards and "explain the significance" cards.
- ${input.questions} quiz questions. About half "mc", a third "cloze", the rest "open". Target difficulty: ${input.difficulty}.
- For "cloze", replace exactly one key term in a sentence from the source with ______ and put that term in "answer".
- "source" is a short verbatim quote (<200 chars) from the material supporting the question.
- Podcast: 14-24 alternating lines, roughly 5 minutes when read aloud.

SOURCE MATERIAL:
"""
${input.text}
"""`;
}

/** Coerce arbitrary model output into a well-formed GeneratedContent. */
export function normalizeContent(raw: any, fallbackTitle: string): GeneratedContent {
  const str = (v: any, d = "") => (typeof v === "string" ? v.trim() : d);
  const arr = (v: any): any[] => (Array.isArray(v) ? v : []);

  const keyTerms = arr(raw?.keyTerms)
    .map((t) => ({ term: str(t?.term ?? (typeof t === "string" ? t : "")), definition: str(t?.definition) }))
    .filter((t) => t.term)
    .slice(0, 24);

  const flashcards: Flashcard[] = arr(raw?.flashcards)
    .map((c) => {
      const front = str(c?.front ?? c?.question);
      const back = str(c?.back ?? c?.answer);
      if (!front || !back) return null;
      return {
        id: uid("card"),
        front,
        back,
        hint: str(c?.hint) || undefined,
        tags: arr(c?.tags).map((t) => str(t)).filter(Boolean).slice(0, 4),
        srs: { box: 1, due: Date.now(), reps: 0, lapses: 0 },
      } as Flashcard;
    })
    .filter(Boolean)
    .slice(0, 60) as Flashcard[];

  const questions: Question[] = arr(raw?.questions)
    .map((q) => {
      const type = ["mc", "cloze", "open"].includes(str(q?.type)) ? (str(q.type) as Question["type"]) : null;
      const prompt = str(q?.prompt ?? q?.question);
      if (!type || !prompt) return null;
      const options = arr(q?.options).map((o) => str(o)).filter(Boolean);
      let answer = str(q?.answer);
      let answerIndex = Number.isInteger(q?.answerIndex) ? q.answerIndex : options.indexOf(answer);
      if (type === "mc") {
        if (options.length < 2) return null;
        if (answerIndex < 0 || answerIndex >= options.length) answerIndex = 0;
        answer = options[answerIndex];
      }
      if (!answer && type !== "open") return null;
      return {
        id: uid("q"),
        type,
        prompt,
        options: type === "mc" ? options : undefined,
        answer: answer || str(q?.explanation) || "See your notes.",
        answerIndex: type === "mc" ? answerIndex : undefined,
        explanation: str(q?.explanation),
        source: str(q?.source) || undefined,
        difficulty: (["easy", "medium", "hard"].includes(str(q?.difficulty)) ? str(q.difficulty) : "medium") as Question["difficulty"],
      } as Question;
    })
    .filter(Boolean)
    .slice(0, 40) as Question[];

  const podcast: PodcastLine[] = arr(raw?.podcast)
    .map((l) => {
      const speaker = str(l?.speaker).toUpperCase().startsWith("B") ? "B" : "A";
      const text = str(l?.text ?? l?.line).replace(/[*#`>]/g, "").trim();
      return text ? ({ speaker, text } as PodcastLine) : null;
    })
    .filter(Boolean)
    .slice(0, 40) as PodcastLine[];

  const sections = arr(raw?.sections)
    .map((s) => ({
      heading: str(s?.heading) || "Section",
      bullets: arr(s?.bullets).map((b: any) => str(typeof b === "string" ? b : b?.text)).filter(Boolean).slice(0, 8),
    }))
    .filter((s) => s.bullets.length);

  return {
    summary: str(raw?.summary) || "No summary was generated.",
    outline: arr(raw?.outline).map((o: any) => str(o)).filter(Boolean).slice(0, 16),
    keyTerms,
    facts: arr(raw?.facts).map((f: any) => str(f)).filter(Boolean).slice(0, 16),
    sections,
    notesMarkdown: str(raw?.notesMarkdown) || buildFallbackNotes(raw, fallbackTitle),
    flashcards,
    questions,
    podcast,
    podcastTitle: str(raw?.podcastTitle) || `Storm Sessions — ${fallbackTitle}`,
  };
}

function buildFallbackNotes(raw: any, title: string): string {
  const lines: string[] = [`# ${title}`, "", "## Summary", String(raw?.summary ?? "").trim(), ""];
  const terms = Array.isArray(raw?.keyTerms) ? raw.keyTerms : [];
  if (terms.length) {
    lines.push("## Key terms");
    for (const t of terms) {
      const term = typeof t === "string" ? t : t?.term;
      const def = typeof t === "string" ? "" : t?.definition;
      lines.push(`- **${term}**${def ? ` — ${def}` : ""}`);
    }
    lines.push("");
  }
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];
  if (sections.length) {
    lines.push("## Study notes");
    for (const s of sections) {
      lines.push(`### ${s?.heading ?? "Section"}`);
      for (const b of s?.bullets ?? []) lines.push(`- ${typeof b === "string" ? b : b?.text ?? ""}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

/* ---------------------------------- chat --------------------------------- */

export function chatSystem(context: string, title: string): string {
  return `You are the StormLearn AI tutor for the study set "${title}".
Answer using the source material below as your primary reference.
- Be concise and exam-focused: 2-6 sentences unless the student asks for more.
- Use markdown sparingly (bold for key terms, short bullet lists).
- If the answer is not in the source, say so plainly, then give your best general explanation and flag it as outside the material.
- Never invent quotes from the source.

SOURCE MATERIAL:
"""
${context}
"""`;
}

export function chatUserPrompt(messages: { role: string; content: string }[]): string {
  const history = messages
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n\n");
  return `Continue this tutoring conversation.\n\n${history}`;
}
