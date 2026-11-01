# StormLearn ⚡

**The fastest way to learn anything.** One source in — a complete study kit out.

StormLearn is a Turbo-AI-style learning app: you drop in a lecture recording, a PDF, a
YouTube link or your own rough notes, and it builds **structured notes, spaced-repetition
flashcards, a mixed-format quiz, a two-host study podcast and a source-grounded AI tutor**
from that single source.

---

## What's in it

| Area | Route | What it does |
| --- | --- | --- |
| Library | `/` | All your study sets with search, subject filters, mastery rings, live stats, due-card counts |
| Create | `/new` | Five input modes — paste, upload, YouTube, record live, blank page — plus output controls |
| Study set | `/set/[id]` | Six tabs: Notes · Flashcards · Quiz · Tutor · Podcast · Source |
| Review due | `/review` | One cross-set spaced-repetition queue, interleaved by subject |
| Settings | `/settings` | AI provider + key, model picker, connection test, export/import, shortcuts |

### The six tabs

- **Notes** — generated markdown notes with summary, glossary, sections, "memorise these"
  facts and an outline rail. Edit inline (rich text) or as raw markdown. Select any passage
  and run **simplify / expand / explain / bullets** on it. Autosaves.
- **Flashcards** — 3D flip cards with hints, keyboard control (`space`, `1-4`, `←→`, `H`),
  a Leitner memory-box scheduler, session stats and a deck manager (search, filter by
  due/new/learned, edit, delete, add, generate more).
- **Quiz** — three question types (multiple choice, fill-in-the-blank, short answer with
  model answer + self-grading), instant feedback, per-question source quotes, a score ring,
  full answer review, and one-click "turn my misses into flashcards".
- **Tutor** — chat grounded in *your* source. With the demo engine it answers extractively
  and cites the exact sentences it used; with an API key it reasons properly.
- **Podcast** — a scripted two-host study show (Nova asks and quizzes, Miles explains) that
  plays aloud in the browser with two distinct voices, a live waveform, rate control,
  click-to-seek transcript and script download.
- **Source** — the extracted text/transcript, searchable and editable, plus the embedded
  YouTube player when the set came from a video. Edit it and regenerate to rebuild everything.

### Input support

| Input | How |
| --- | --- |
| Paste text | notes, articles, transcripts |
| PDF | text extracted **in the browser** with pdf.js (file never uploaded) |
| DOCX / PPTX | unzipped and parsed client-side (no dependencies) |
| TXT / MD / CSV | read directly |
| Audio & video files | transcribed server-side with OpenAI Whisper (**needs an OpenAI key**) |
| YouTube links | captions fetched server-side; falls back to a paste box when a video has none |
| Live recording | in-browser AI notetaker using the Web Speech API, with timestamped lines |
| Blank page | write it yourself, then generate study materials from it |

---

## Two engines

**1. Built-in demo engine (default, zero config).** A dependency-free NLP pipeline in
`src/lib/demo-engine.ts`: paragraph/heading detection, sentence splitting, noun-phrase key
term extraction with verb-inflection and clause-spanning rejection, subsumption of redundant
phrases, definition mining from copula / appositive / "refers to" / "we call this X"
patterns with subject-anchoring validation, information-dense sentence ranking, cloze target
selection, and a template-driven two-host podcast script. Everything it produces is traceable
to a sentence in your source, and it works offline.

**2. Real LLMs (optional).** Add a key in Settings and generation, the tutor, note rewriting
and audio transcription switch to the model — with the demo engine kept as an automatic
fallback if the provider errors or returns malformed JSON.

| Provider | Used for |
| --- | --- |
| OpenAI | generation, tutor, rewriting, **Whisper audio transcription** |
| Anthropic | generation, tutor, rewriting (great for long lectures) |
| Google Gemini | generation, tutor, rewriting (huge context) |

Keys are stored in `localStorage` and sent only to that provider plus this app's own API
routes. **Use a restricted, low-limit key** — it lives in the browser.

---

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Production:

```bash
npm start
```

`npm start` is **self-healing**: a `prestart` hook (`scripts/prestart.mjs`) checks for
`node_modules/next` and `.next/BUILD_ID`, and installs or rebuilds whichever is missing
before handing over to `next start`. That matters because both are build artifacts — they
aren't part of the persisted workspace, so a fresh sandbox or a clean checkout has the
source but nothing installed or compiled. One command recovers from that state:

```bash
npm start        # installs if needed → builds if needed → serves on 0.0.0.0:3000
```

When everything is already in place the hook exits immediately and adds no startup cost.
The equivalent manual sequence is:

```bash
npm ci && npm run build && npx next start -H 0.0.0.0 -p 3000
```

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · pdf.js.
No database — study sets persist in the browser's `localStorage`, with JSON export/import
in Settings.

## API routes

| Endpoint | Purpose |
| --- | --- |
| `POST /api/generate` | source text → full study kit (LLM if configured, else demo engine) |
| `POST /api/chat` | tutor answer grounded in a set's source |
| `POST /api/rewrite` | simplify / expand / explain / bullets on a notes selection |
| `POST /api/youtube` | resolve a YouTube URL → title + caption transcript |
| `POST /api/transcribe` | audio file → timestamped transcript (OpenAI Whisper) |
| `POST /api/test` | verify a provider key works |

## Keyboard

`space`/`enter` flip a card · `1-4` grade it Again/Hard/Good/Easy · `←→` move · `H` hint ·
`enter` send to the tutor · `shift+enter` newline.

## Notes & limitations

- Speech synthesis and the Web Speech API depend on the browser. Chrome/Edge give the best
  podcast voices; Safari works; Firefox has no live transcription (upload or paste instead).
  Inside a sandboxed iframe, microphone access may be blocked — the UI says so and offers
  the alternatives.
- YouTube caption fetching works when the video exposes caption tracks; restricted or
  caption-less videos fall back to a paste box.
- `localStorage` is capped around 5 MB, so very large libraries should be exported
  periodically (Settings → Export all).
