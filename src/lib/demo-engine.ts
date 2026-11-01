/**
 * demo-engine.ts
 * ---------------------------------------------------------------------------
 * A dependency-free "study material generator". It reads raw text (a lecture
 * transcript, PDF extraction, pasted notes...) and produces:
 *   - structured markdown notes
 *   - flashcards (definitions + cloze deletions)
 *   - a quiz (multiple choice, fill-in-the-blank, short answer)
 *   - a two-host study podcast script
 *   - an extractive answer for the tutor chat
 *
 * It is intentionally deterministic and explainable: everything it outputs is
 * traceable back to a sentence in the source. When a real LLM key is present
 * the app prefers the LLM and only falls back to this engine.
 * ---------------------------------------------------------------------------
 */

import type {
  Flashcard,
  GeneratedContent,
  KeyTerm,
  NoteSection,
  PodcastLine,
  Question,
} from "./types";
import { clamp, pick, shuffle, uid } from "./utils";

/* ---------------------------------- text --------------------------------- */

/* --------------------------- linguistic resources --------------------------- */

const STOPWORDS = new Set(
  `a about above after again against all almost along already also although always am among an and another any anybody anything anywhere are aren around as at away be became because been before began begin beginning behind being below beside besides best better between beyond both brief but by came can cannot cant could couldn currently did didn different do does doesn doing don done down during each earlier ed either else elsewhere enough entirely especially etc even ever every everybody everything everywhere except few fifth first five for former formerly forth four found further furthermore get gets getting go goes going gone got gotten great had hadn half happen hardly has hasn have haven having he hence her here herself hes high him himself his hither how however i if in indeed inside instead into is isnt it its itself just keep keeps kept know known knows large largely last lately later latter latterly least less lest like likely little look looking looks made mainly make makes many may maybe me mean meantime meanwhile merely might more moreover most mostly much must my myself namely near nearly necessary neither never nevertheless new next nine no nobody none nonetheless noone nor normally not nothing novel now nowhere obviously of off often oh ok okay on once one only onto or other others otherwise ought our ours ourselves out outside over overall own particular particularly per perhaps please plus possible present presumably probably provides put puts quite rather really reason regarding regardless relatively respectively right said same saw say saying says second see seeing seem seemed seeming seems seen self selves sensible sent serious seriously seven several shall she should shouldn since six so some somebody somehow someone something sometime sometimes somewhat somewhere soon sorry still sub such suppose sure take taken takes tell tends than thank thanks that thats the their theirs them themselves then thence there therefore these they thing things think third this thorough thoroughly those though three through throughout thus to together too took toward towards tried tries truly try trying twice two under unless unlike until unto up upon us use used useful uses using usually various very via viz vs want wants was wasn way ways we well went were weren what whatever whats when whence whenever where whereas whereby wherein wheres whether which while whither who whoever whole whom whose why will willing wish with within without won wonder work works would wouldn yes yet you your yours yourself yourselves
also across actually additionally already although among another basically began certainly clearly commonly completely considerably currently definitely despite directly earlier easily effectively equally essentially eventually exactly certainly finally frequently generally gradually hereby hereby henceforth immediately importantly indeed initially instead largely later likewise mainly meanwhile meanwhile merely notably nowadays occasionally otherwise overall particularly previously primarily primarily readily recently significantly similarly simply simultaneously slightly somewhat specifically subsequently successfully therefore thereby therein thereof thereby thus typically ultimately virtually widely
example examples fact facts point points part parts case cases question questions answer answers problem problems idea ideas lot end side times time day days year years chapter section number numbers way ways kind sort type level stage step process result results effect effects cause causes change changes form forms method methods system systems group groups set sets list series order reason reasons use uses value values amount amounts area areas
today tomorrow yesterday currently recently generally usually normally often sometimes always never really actually basically literally approximately exactly simply merely particularly especially significantly obviously clearly certainly definitely probably possibly likely unlikely hopefully presumably
um uh er ah hmm ooh right okay ok so well now then here there today tomorrow let lets gonna wanna dont cant isnt arent doesnt didnt wont thats theres heres youll ive ill im youre theyre weve dont cant isnt very much many`.split(
    /\s+/
  )
);

/** Words that can never begin or end a meaningful key term. */
const TERM_EDGE_BLOCK = new Set([
  "this", "that", "these", "those", "there", "here", "it", "its", "they", "them", "their", "we", "our",
  "us", "you", "your", "i", "he", "she", "his", "her", "if", "when", "while", "because", "although",
  "since", "once", "after", "before", "unless", "until", "whether", "where", "why", "how", "what",
  "which", "who", "whom", "and", "or", "but", "nor", "so", "then", "than", "as", "of", "to", "in",
  "on", "at", "by", "for", "with", "from", "into", "onto", "over", "under", "between", "among",
  "through", "during", "about", "is", "are", "was", "were", "be", "been", "being", "do", "does",
  "did", "have", "has", "had", "will", "would", "can", "could", "should", "may", "might", "must",
  "shall", "not", "no", "yes", "also", "just", "only", "even", "still", "already", "again",
  "finally", "eventually", "immediately", "simply", "really", "actually", "basically", "essentially",
  "remember", "note", "notice", "see", "look", "think", "know", "want", "need", "get", "got", "go",
  "went", "gone", "come", "came", "make", "made", "take", "took", "give", "gave", "tell", "told",
  "say", "said", "call", "called", "keep", "kept", "put", "set", "let", "left", "called", "named",
  "many", "much", "more", "most", "few", "several", "all", "any", "some", "each", "every", "both",
  "either", "neither", "other", "another", "such", "same", "different", "new", "old", "first",
  "second", "third", "next", "last", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "today", "tonight", "now", "then", "here", "there",
]);

/** Inflected verb forms — a key term is a noun phrase, never "adopted agreements". */
const VERB_INFLECTION = /^(?:(?<![lk])[a-z]{3,}ing|[a-z]{4,}ed|is|are|was|were|be|been|being|has|have|had|does|did|can|could|will|would|should|may|might|must|shall|lets|make|makes|take|takes|give|gives|say|says|tell|tells|keep|keeps|put|puts|let|set|use|uses|mean|means|call|calls|show|shows|lead|leads|hold|holds|run|runs|begin|begins|spend|spends|earn|earns|combine|combines|release|releases|regenerate|regenerates|harvest|harvests|convert|converts|contain|contains|guarantee|guarantees|allow|allows|require|requires|produce|produces|provide|provides|create|creates|meet|meets|convene|convenes|impose|imposes|repeal|repeals|reject|rejects|intimidate|intimidates|adopt|adopts|tax|taxes|end|ends|win|wins|lose|loses|fight|fights|occur|occurs|donate|donates|pump|pumps|flow|flows|split|splits|fold|folds|increase|increases|decrease|decreases|block|blocks|inhibit|inhibits|activate|activates|regulate|regulates|transport|transports|enter|enters|form|forms|yield|yields|store|stores|insert|inserts|delete|deletes|search|searches|traverse|traverses|visit|visits|differ|differs|satisfy|satisfies|degenerate|degenerates|rebalance|rebalances|restore|restores|capture|captures|reject)$/i;

const VERBS = new Set(
  `adopted intimidated convinced recognised ceded convened created appointed met organised destroyed closed revoked expanded began ended signed drafted fired blocked halted leaked released captured trapped forced produced provided allowed required imposed repealed rejected tax occurs occurred happen happens happened involve involves involved contain contains contained describe describes described explain explains explained note notes notice show shows demonstrates demonstrates means mean refer refers referred call called know knows think thinks want wants need needs get gets got make makes made take takes took give gives gave tell tells told say says said keep keeps kept put puts let lets set sets use uses used see sees saw come comes came go goes went become becomes became remain remains remained appear appears appeared seem seems seemed look looks looked turn turns turned move moves moved change changes changed increase increases increased decrease decreases decreased build builds built break breaks broke grow grows grew fall falls fell rise rises rose reduce reduces reduced
  power powers powers leads lead led gives given give helps help helped turns adds add shows shown prove proves proves seems becomes remains returns consists depends relies belongs applies exists exists follow follows follows precede precedes exceeds matches match violates violate satisfies satisfy indicates suggest suggests implies imply causes cause yields generates generate generates forms forms creates builds constructs construct stores stored runs ran executes execute performs perform calculates calculate determines determine determines measures measures compares compare contrasts differ differs differs varies vary ensures ensure enables enable prevents prevent avoids avoid requires requires supports support carries carry transports transfer transfers shifts shift splits split joins join combines combine separates separate removes remove deletes delete inserts insert traverses traverse visits visit searches search sorts sort filters filter maps map reduces reduce binds bind attach attaches detaches release free frees allocate allocates reserves reserve consumes consume spends spend earns earn wins won loses lost fights fought destroys destroy collapses collapse expands expand contracts contract rotates rotate rebalances rebalance restores restore guarantees guarantee ensures ensure permits permit forbids forbid prohibits prohibit restricts restrict extends extend shortens shorten lengthens lengthen widens widen narrows narrow deepens deepen strengthens strengthen weakens weaken improves improve worsens degrade degrades evolves evolve adapts adapt mutates mutate replicates replicate transcribes translate translates transmits transmit receives receive sends send delivers deliver returns return rejects reject accepts accept adopts adopt abandons abandon`.split(
    /\s+/
  )
);

/** Words that betray a phrase spanning two clauses rather than one concept. */
const INTERNAL_BLOCK = new Set(
  `from into onto upon toward towards within without throughout among between against behind beyond before after during since until while because although unless whether whereas therefore however moreover furthermore instead rather quite very also just only even still already again then than when where why how which who whom whose what that this these those here there upwards downwards backwards forwards onward backward forward onward respectively approximately exactly simply merely actually literally basically essentially conventionally typically usually generally commonly frequently rarely never always often sometimes immediately directly gradually eventually finally initially previously currently simultaneously specifically particularly notably especially
  met organised destroyed closed revoked expanded began ended signed drafted fired halted leaked captured trapped forced produced provided created allowed required imposed repealed rejected intimidated adopted convened recognised ceded appointed created
  documents newspapers pamphlets legal printed`.split(/\s+/)
);

export interface Sentence {
  text: string;
  start: number;
  end: number;
  words: string[];
}

export interface Paragraph {
  heading: string | null;
  /** the heading line exactly as written, before summarisation */
  rawHeading: string | null;
  text: string;
  sentences: Sentence[];
}

export interface Definition {
  term: string;
  meaning: string;
  sentence: Sentence;
}

export interface Analysis {
  normalized: string;
  paragraphs: Paragraph[];
  sentences: Sentence[];
  terms: string[];
  /** canonical display form keyed by lowercase */
  termByLower: Map<string, string>;
  /** every plausible noun phrase with its count, used to validate definition subjects */
  phraseCounts: Map<string, number>;
  definitions: Definition[];
  facts: string[];
  outline: string[];
  wordCount: number;
}

const HEADING_STOP = /^(so|and|but|then|now|ok|okay|um|uh|also|however|therefore|because|if|when|while|this|that|these|those|the|a|an|i|we|you|they|he|she|it|let|lets|next|finally|remember|note|in|on|at|to|for|with|as|of|is|are|was|were|do|does|did|have|has|had|will|would|can|could|should|may|might|must|not|no|yes|what|which|who|how|why|our|my|your|their|its|here|there)\b/i;

function isHeadingCandidate(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 72) return false;
  if (/[.!?]$/.test(t)) return false;
  if (HEADING_STOP.test(t)) return false;
  if (/^\s*[-*•]\s+/.test(t)) return false;
  const words = t.split(/\s+/);
  const allShort = words.length <= 9;
  const alpha = words.filter((w) => /[a-z]/i.test(w));
  const lower = alpha.filter((w) => /^[a-z]/.test(w)).length;
  const titleCase = lower > 0 && lower / Math.max(1, alpha.length) < 0.5;
  const isNumbered = /^(\d+[.)]|#{1,4}|chapter|section|part|unit|lesson|module|step)\b/i.test(t);
  const isLabel = /^(summary|introduction|overview|conclusion|key points|takeaways|objectives|background|method|methods|results|discussion|references|notes|outline|appendix)\s*:?\s*$/i.test(t);
  return allShort && (titleCase || isNumbered || isLabel || t === t.toUpperCase());
}

function cleanHeading(t: string): string {
  return t
    .trim()
    .replace(/^#{1,4}\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .replace(/[:：]\s*$/, "");
}

export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/** Split text into sentences, tolerant of abbreviations and decimals. */
export function splitSentences(text: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  const re = /[^.!?…\n]+(?:[.!?…]+["'”’)\]]*|\n|$)/g;
  let m: RegExpExecArray | null;
  const ABBR = /\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|cf|Fig|No|Vol|Inc|Ltd|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|U\.S|U\.K)\.$/i;
  while ((m = re.exec(text))) {
    const s = m[0].trim();
    if (!s || s.length < 3) continue;
    if (ABBR.test(s)) continue;
    out.push({ text: s, start: m.index, end: m.index + m[0].length });
  }
  if (!out.length && text.trim()) out.push({ text: text.trim(), start: 0, end: text.length });
  return out;
}

function wordList(s: string): string[] {
  return (s.toLowerCase().match(/[a-z][a-z'-]+/gi) || []).map((w) => w.replace(/^[-']+|[-']+$/g, ""));
}

function scoreTerm(term: string): number {
  const ws = term.toLowerCase().split(/\s+/).filter((w) => !STOPWORDS.has(w));
  if (!ws.length) return 0;
  let base = ws.reduce((a, w) => a + Math.min(w.length, 12), 0);
  if (ws.length > 1) base *= 1.55;
  if (/^[A-Z]{2,6}$/.test(term)) base *= 1.5;
  if (/\d/.test(term)) base *= 0.6;
  if (term.length > 42) base *= 0.5;
  return base;
}

export function analyze(text: string): Analysis {
  const normalized = normalizeText(text);
  const rawLines = normalized.split("\n");

  /* ------------------------------ paragraphs ----------------------------- */
  const paragraphs: Paragraph[] = [];
  let bucket: string[] = [];
  let pendingHeading: string | null = null;

  const flush = () => {
    const body = bucket.join(" ").trim();
    bucket = [];
    const sents = splitSentences(body).map((s) => ({ ...s, words: wordList(s.text) }));
    if (!sents.length) {
      pendingHeading = null;
      return;
    }
    paragraphs.push({ heading: pendingHeading, rawHeading: pendingHeading, text: body, sentences: sents });
    pendingHeading = null;
  };

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (isHeadingCandidate(line)) {
      if (bucket.length) flush();
      pendingHeading = cleanHeading(line);
      continue;
    }
    bucket.push(line);
  }
  flush();

  // A wall of text with no headings: chunk into pseudo-paragraphs.
  if (paragraphs.length <= 1 && normalized.length > 1200) {
    const all = splitSentences(normalized).map((s) => ({ ...s, words: wordList(s.text) }));
    const chunkCount = Math.min(9, Math.max(3, Math.round(all.length / 7)));
    const size = Math.max(3, Math.ceil(all.length / chunkCount));
    const chunks: Paragraph[] = [];
    for (let i = 0; i < all.length; i += size) {
      const slice = all.slice(i, i + size);
      chunks.push({ heading: null, rawHeading: null, text: slice.map((s) => s.text).join(" "), sentences: slice });
    }
    paragraphs.length = 0;
    paragraphs.push(...chunks);
  }

  const sentences: Sentence[] = paragraphs.flatMap((p) => p.sentences);
  const docWords = (normalized.match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019.-]*/gu) || []).length || 1;

  /* ------------------------------- phrases ------------------------------- */
  const phraseCounts = new Map<string, number>();
  const phraseDisplay = new Map<string, string>();
  const addPhrase = (phrase: string) => {
    const key = phrase.replace(/\s+/g, " ").trim();
    if (!key) return;
    let low = key.toLowerCase();

    // Fold a plural phrase onto its singular when the singular is also used in
    // the document, so "AVL trees" supports the concept "AVL tree". Only when
    // the singular already exists, so "Intolerable Acts" is never mangled.
    const ws = low.split(" ");
    if (ws.length > 1) {
      const last = ws[ws.length - 1];
      let singular: string | null = null;
      if (/[^s]s$/.test(last) && !/(us|is|ss)$/.test(last)) singular = last.slice(0, -1);
      else if (/ies$/.test(last) && last.length > 4) singular = `${last.slice(0, -3)}y`;
      if (singular && phraseCounts.has([...ws.slice(0, -1), singular].join(" "))) {
        low = [...ws.slice(0, -1), singular].join(" ");
      }
    }

    phraseCounts.set(low, (phraseCounts.get(low) || 0) + 1);
    const display = low === key.toLowerCase() ? key : low.replace(/\b\w/g, (ch) => ch);
    const prev = phraseDisplay.get(low);
    // prefer a Title Case display form when the source has one
    if (!prev || (!/[A-Z]/.test(prev) && /[A-Z]/.test(display))) phraseDisplay.set(low, display);
  };

  for (const s of sentences) {
    // Extract n-grams inside clause boundaries only, otherwise punctuation-free
    // tokenisation invents phrases like "node postorder" from "left, right, node;
    // postorder is used to...".
    const clauses = s.text.split(/(?<=[\n;:,()\[\]])\s+|\s+(?:and|or|but|where|which|while|because|so|than|then)\s+/i);
    for (const clause of clauses) {
      const toks = clause.match(/[A-Za-z][A-Za-z'-]*|\d+(?:\.\d+)?%?/g) || [];
      for (let i = 0; i < toks.length; i++) {
        for (const n of [1, 2, 3]) {
          const gram = toks.slice(i, i + n);
          if (gram.length < n) break;
          if (gram.some((g) => STOPWORDS.has(g.toLowerCase()) || g.length < 2)) break;
          if (/^\d/.test(gram[0])) break;
          addPhrase(gram.join(" "));
        }
      }
    }
    const acr = s.text.matchAll(/([A-Z][A-Za-z-]{2,40}(?:\s+[A-Z][A-Za-z-]{2,40}){0,4})\s*\(([A-Z]{2,7})\)/g);
    for (const m of acr) {
      addPhrase(m[1].trim());
      addPhrase(m[2]);
    }
  }

  /* --------------------------- candidate terms --------------------------- */
  type Cand = { key: string; display: string; count: number; score: number; words: number };
  const candidates: Cand[] = [];
  for (const [key, count] of phraseCounts) {
    const display = phraseDisplay.get(key) || key;
    if (key.length < 4 || key.length > 44) continue;
    if (/[:;,()"“”‘’]/.test(key)) continue;
    if (/\d/.test(key) && !/^[a-z]/.test(key)) continue;
    const ws = key.split(" ");
    if (ws.length > 4) continue;
    if (TERM_EDGE_BLOCK.has(ws[0]) || TERM_EDGE_BLOCK.has(ws[ws.length - 1])) continue;
    // Concepts are noun phrases: reject anything containing an inflected verb
    // ("adopted non-importation agreements", "trees guarantee", "congress convened").
    if (ws.some((w) => VERB_INFLECTION.test(w) || VERBS.has(w))) continue;
    // Reject n-grams that accidentally span a clause boundary
    // ("classes from fastest", "internal node backwards", "documents newspapers pamphlets").
    if (ws.length > 1 && ws.slice(1).some((w) => INTERNAL_BLOCK.has(w))) continue;
    if (new Set(ws).size !== ws.length) continue;
    if (ws.length === 1 && display.length < 4 && !/^[A-Z]{2,6}$/.test(display)) continue;
    // Cohesion: a real compound concept is made of words that are each used on
    // their own elsewhere ("avl" + "tree"), unlike an accidental word run.
    let cohesion = 1;
    if (ws.length > 1) {
      const solo = ws.filter((w) => (phraseCounts.get(w) || 0) >= 2).length;
      cohesion = 0.55 + 0.45 * (solo / ws.length);
    }
    candidates.push({
      key,
      display,
      count,
      words: ws.length,
      score: scoreTerm(display) * (1 + Math.log(1 + count)) * (1 + (count / docWords) * 420) * cohesion,
    });
  }
  candidates.sort((a, b) => b.score - a.score);

  // Subsume a shorter phrase inside a longer one only when the longer phrase is
  // clearly the dominant form ("mitochondrial membrane" inside "inner
  // mitochondrial membrane"). Otherwise keep both: "AVL tree", "red black tree"
  // and "binary search tree" are distinct concepts even though "tree" is common.
  const selected: Cand[] = [];
  for (const c of candidates) {
    if (selected.length >= 44) break;
    const subsumed = selected.some((s) => {
      if (s.key === c.key || s.words <= c.words) return false;
      if (!new RegExp(`(?:^| )${c.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: |$)`).test(s.key)) return false;
      if (c.words === 1) return s.count >= Math.max(3, c.count * 1.2);
      return s.count >= c.count || s.score >= c.score * 0.9;
    });
    if (subsumed) continue;
    selected.push(c);
  }

  const terms = selected.map((c) => c.display);
  const termByLower = new Map(selected.map((c) => [c.key, c.display]));

  /* ----------------------------- definitions ----------------------------- */
  const definitions: Definition[] = [];
  const seen = new Set<string>();

  const DEFINITIONAL = /\b(?:defined as|known as|called|referred to as|described as|consists of|composed of|made up of|means|refers to|stands for|denotes|represents|is when|is where|is what)\b/i;
  const COPULA = /^(.{3,52}?)\s+(?:is|are|was|were)\s+(?!not\b)(.{10,})$/i;
  const VERB_DEF = /^(.{3,52}?)\s+(?:refers to|means|stands for|describes|represents|denotes|measures|captures)\s+(.{10,})$/i;
  const APPOSITIVE = /^(.{3,48}?),\s+(?:also (?:known|called|referred to) as\s+)?(?:a|an|the)\s+(.{10,})$/i;
  const WE_CALL = /^(?:we|i|people|scientists|historians|biologists)\s+(?:call|refer to)\s+(?:this|these|that|those|it)\s+(.{3,48})$/i;

  const accept = (
    rawTerm: string,
    rawMeaning: string,
    sentence: Sentence,
    opts: { anchored: boolean; requireKnown: boolean }
  ) => {
    let term = rawTerm.trim().replace(/^(the|a|an)\s+/i, "").replace(/\s+[,;:.]+$/, "").trim();
    const meaning = rawMeaning.trim();
    if (!term || !meaning) return false;
    if (term.length < 3 || term.length > 48) return false;
    if (meaning.length < 14 || meaning.length > 340) return false;
    if (/[:;,()"\u201c\u201d\u2018\u2019]/.test(term)) return false;
    const tLow = term.toLowerCase();
    const tWords = tLow.split(/\s+/);
    if (TERM_EDGE_BLOCK.has(tWords[0]) || TERM_EDGE_BLOCK.has(tWords[tWords.length - 1])) return false;
    if (VERBS.has(tWords[0]) || VERB_INFLECTION.test(tWords[0])) return false;
    if (seen.has(tLow)) return false;

    // The matched subject must genuinely be this sentence's subject, otherwise we
    // would "define" acetyl CoA from "...combines with oxaloacetate, a four carbon
    // molecule, to form citrate".
    if (opts.anchored) {
      const sLow = sentence.text.toLowerCase().replace(/^[\s\u2022\-*\u2013\u2014]+/, "").trim();
      const anchored =
        sLow.startsWith(tLow) ||
        sLow.startsWith(`the ${tLow}`) ||
        sLow.startsWith(`a ${tLow}`) ||
        sLow.startsWith(`an ${tLow}`);
      if (!anchored) return false;
    }

    // The subject must be a concept this document actually discusses.
    if (opts.requireKnown && !termByLower.has(tLow)) return false;
    if ((phraseCounts.get(tLow) || 0) < 1) return false;


    // "X is X" or heading echoes carry no information.
    const mLow = meaning.toLowerCase().replace(/\W+/g, "");
    if (mLow === tLow.replace(/\W+/g, "")) return false;
    if (mLow.startsWith(tLow.replace(/\W+/g, "")) && meaning.split(/\s+/).length < 4) return false;
    // The meaning should not simply repeat the subject verbatim at its start.
    if (meaning.toLowerCase().startsWith(tLow) && meaning.length - term.length < 20) return false;

    seen.add(tLow);
    definitions.push({
      term: termByLower.get(tLow) || phraseDisplay.get(tLow) || capitalise(term),
      meaning: tidy(meaning),
      sentence,
    });
    return true;
  };

  for (const s of sentences) {
    if (definitions.length >= 45) break;
    const clean = s.text
      .replace(/^[\s•\-*–—]+/, "")
      .replace(/^(so|and|but|well|now|ok|okay|um|uh|right|also|then|finally|next|remember|note|again|here|there|today|basically|actually|essentially|critically|importantly)\s*,?\s*/i, "")
      .trim();
    if (clean.length < 16) continue;

    let done = false;

    const wc = clean.match(WE_CALL);
    if (wc) done = accept(wc[1], `the term used for this idea in the material`, s, { anchored: false, requireKnown: true });

    if (!done) {
      const ap = clean.match(APPOSITIVE);
      if (ap) done = accept(ap[1], ap[2], s, { anchored: true, requireKnown: true });
    }

    if (!done) {
      const vd = clean.match(VERB_DEF);
      if (vd) done = accept(vd[1], vd[2], s, { anchored: true, requireKnown: true });
    }

    if (!done) {
      const cop = clean.match(COPULA);
      if (cop) done = accept(cop[1], cop[2], s, { anchored: true, requireKnown: true });
    }
  }

  /* --------------------------------- facts -------------------------------- */
  const facts: string[] = [];
  for (const s of sentences) {
    const hasNumber = /\b\d[\d,.]*\s?(?:%|percent|million|billion|thousand|km|kg|cm|mm|°C|°F|mol|atm|nm|μm|ms|years?|days?|hours?|times)?/i.test(s.text);
    const hasDate = /\b(?:\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}|\d{1,2}(?:st|nd|rd|th)\s+(?:century|millennium))\b/i.test(s.text);
    if ((hasNumber || hasDate) && s.text.length > 28 && s.text.length < 250) facts.push(tidy(s.text));
    if (facts.length >= 26) break;
  }

  /* -------------------------------- outline ------------------------------- */
  const defLower = new Map(definitions.map((d) => [d.term.toLowerCase(), d]));
  const outline: string[] = [];
  for (const p of paragraphs) {
    if (p.heading) {
      outline.push(p.heading);
      continue;
    }
    if (!p.sentences.length) continue;
    const best = [...p.sentences].sort(
      (a, b) => rankSentence(b, termByLower, defLower) - rankSentence(a, termByLower, defLower)
    )[0];
    outline.push(shorten(tidy(best.text), 88));
  }

  return {
    normalized,
    paragraphs,
    sentences,
    terms,
    termByLower,
    phraseCounts,
    definitions,
    facts: dedupe(facts).slice(0, 12),
    outline: dedupe(outline).slice(0, 12),
    wordCount: docWords,
  };
}

export interface DemoOptions {
  title: string;
  cards?: number;
  questions?: number;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
}

/* ------------------------------ ranking utils ----------------------------- */

function rankSentence(s: Sentence, termByLower: Map<string, string>, defLower: Map<string, Definition>): number {
  let score = 0;
  const low = s.text.toLowerCase();
  for (const key of termByLower.keys()) if (low.includes(key)) score += 2;
  for (const d of defLower.values()) if (low.includes(d.term.toLowerCase())) score += 3;
  if (/\b(because|therefore|thus|leads to|results in|causes|means that|which is why)\b/i.test(low)) score += 3;
  if (/\d/.test(s.text)) score += 2;
  if (/\b(?:key|important|critical|essential|crucial|remember|must|always|never|main|primary|major|central|dominant)\b/i.test(low)) score += 3;
  if (DEFINITIONAL_CUE.test(low)) score += 3;
  if (s.text.length > 45 && s.text.length < 235) score += 2;
  if (s.text.length > 330) score -= 2;
  if (s.text.length < 24) score -= 4;
  return score;
}

const DEFINITIONAL_CUE = /\b(?:is defined as|known as|referred to as|consists of|means|refers to|stands for)\b/i;

const GENERIC_FILLER =
  /\b(?:textbooks will tell you|as you can see|i think you|you should|we will see|let me|let's|i want you|don't forget|as i said|you might think|most people|many people|by the end of|at the end of the|welcome back|thank you)\b/i;

function tidy(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s•\-*–—]+/, "")
    .replace(/^(um|uh|er|hmm|well|so|right|ok|okay|and|but|then|now|also|actually|basically|literally|you know|kind of|sort of|I mean|I think)\b[,\s]*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function shorten(s: string, n: number): string {
  const clean = (s || "").trim();
  if (clean.length <= n) return clean;
  const cut = clean.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return `${cut.slice(0, sp > n * 0.45 ? sp : n).replace(/[,;:]$/, "")}…`;
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of arr) {
    const k = a.toLowerCase().replace(/\W+/g, "");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

function capitalise(s: string): string {
  const t = (s || "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function headingOf(a: Analysis, s: Sentence | undefined): string {
  if (!s) return "Overview";
  for (const p of a.paragraphs) {
    if (p.sentences.includes(s)) return p.heading || summariseHeading(p.sentences[0]?.text || p.text, a);
  }
  return summariseHeading(s.text, a);
}

function summariseHeading(sentence: string, a: Analysis): string {
  const low = sentence.toLowerCase();
  // Prefer a term with an explicit definition, then the most specific early term.
  const defined = a.definitions.find((d) => low.includes(d.term.toLowerCase()));
  if (defined) return defined.term;
  const hits = a.terms
    .map((t) => ({ t, i: low.indexOf(t.toLowerCase()) }))
    .filter((x) => x.i >= 0 && x.i < 110)
    .sort((x, y) => y.t.split(" ").length - x.t.split(" ").length || y.t.length - x.t.length || x.i - y.i);
  if (hits.length) return capitalise(hits[0].t);
  return shorten(tidy(sentence), 52).replace(/[.!?]$/, "") || "Overview";
}

/** Find the sentence that best explains a term, for glossary fallbacks. */
function findContext(a: Analysis, term: string): string {
  const low = term.toLowerCase();
  const hits = a.sentences.filter(
    (s) =>
      s.text.toLowerCase().includes(low) &&
      s.text.length > 45 &&
      s.text.length < 260 &&
      !GENERIC_FILLER.test(s.text)
  );
  if (!hits.length) return "Referenced in the source material — check the notes for context.";
  const best = hits.sort(
    (x, y) =>
      Number(DEFINITIONAL_CUE.test(y.text)) - Number(DEFINITIONAL_CUE.test(x.text)) ||
      x.text.toLowerCase().indexOf(low) - y.text.toLowerCase().indexOf(low)
  )[0];
  return shorten(tidy(best.text), 210);
}

/* --------------------------------- output -------------------------------- */

export function buildSections(a: Analysis): NoteSection[] {
  const defs = defMap(a);
  const blocks = a.paragraphs
    .map((p) => {
      const headingKeys = [p.heading, p.rawHeading]
        .filter(Boolean)
        .map((h) => (h as string).toLowerCase().replace(/\W+/g, ""));
      const usable = p.sentences.filter((s) => {
        const t = s.text.trim();
        if (t.length < 34) return false;
        const key = t.toLowerCase().replace(/\W+/g, "");
        // never list a heading line as one of its own bullets
        if (headingKeys.some((h) => h && (key === h || (t.length < 90 && (h.includes(key) || key.includes(h)))))) return false;
        if (GENERIC_FILLER.test(t)) return false;
        return true;
      });
      if (!usable.length) return null;
      const ranked = [...usable].sort(
        (x, y) => rankSentence(y, a.termByLower, defs) - rankSentence(x, a.termByLower, defs)
      );
      const chosen = new Set(ranked.slice(0, 4));
      return {
        p,
        usable,
        bullets: usable.filter((s) => chosen.has(s)).map((s) => shorten(tidy(s.text), 235)),
      };
    })
    .filter(Boolean) as { p: Paragraph; usable: Sentence[]; bullets: string[] }[];

  // Give every block a heading that distinguishes it from its siblings, then
  // number any unavoidable collisions.
  const headings = blocks.map((b) => distinctiveHeading(a, b.p, b.usable, blocks.map((x) => x.usable)));
  const seen = new Map<string, number>();
  const resolved = headings.map((h) => {
    const base = h.toLowerCase().replace(/\W+/g, "");
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    const total = headings.filter((x) => x.toLowerCase().replace(/\W+/g, "") === base).length;
    return total > 1 && n > 1 ? `${h} (continued ${n - 1})` : h;
  });

  return blocks
    .map((b, idx) => ({ heading: resolved[idx] || `Part ${idx + 1}`, bullets: b.bullets }))
    .filter((s) => s.bullets.length)
    .slice(0, 12);
}

/**
 * Pick the heading for a block: its explicit heading line if it has one,
 * otherwise the key term that is most concentrated in this block compared with
 * the rest of the document (so siblings don't all end up called "tree").
 */
function distinctiveHeading(a: Analysis, p: Paragraph, usable: Sentence[], allBlocks: Sentence[][]): string {
  if (p.heading) return p.heading;
  const text = usable.map((s) => s.text).join(" ").toLowerCase();
  const scored: { t: string; score: number }[] = [];
  for (const t of a.terms) {
    const low = t.toLowerCase();
    const here = text.split(low).length - 1;
    if (!here) continue;
    let elsewhere = 0;
    for (const other of allBlocks) {
      if (other === usable) continue;
      for (const s of other) elsewhere += s.text.toLowerCase().split(low).length - 1;
    }
    const total = here + elsewhere;
    if (total < 1) continue;
    const share = here / total;
    if (share < 0.34) continue;
    const defined = a.definitions.some((d) => d.term.toLowerCase() === low) ? 1.35 : 1;
    scored.push({ t, score: share * (1 + t.split(" ").length * 0.28) * defined * Math.min(3, here) });
  }
  scored.sort((x, y) => y.score - x.score);
  if (scored.length) return capitalise(scored[0].t);

  const first = usable[0];
  const definedHere = a.definitions.find((d) => first.text.toLowerCase().includes(d.term.toLowerCase()));
  if (definedHere) return definedHere.term;
  return shorten(tidy(first.text), 46).replace(/[.,;:]$/, "") || "Notes";
}

function defMap(a: Analysis): Map<string, Definition> {
  return new Map(a.definitions.map((d) => [d.term.toLowerCase(), d]));
}

/**
 * Rank the key terms in a sentence that would make a clean fill-in-the-blank.
 * Rejects blanks that would butt up against punctuation or an inflection
 * ("two three ______s of pyruvate") and prefers longer, more specific terms.
 */
function clozeTargets(a: Analysis, sentence: string): string[] {
  const low = sentence.toLowerCase();
  const hits = [...a.termByLower.keys()].filter((k) => low.includes(k));
  const clean = hits.filter((k) => {
    const i = low.indexOf(k);
    const after = low[i + k.length] || "";
    const before = i > 0 ? low[i - 1] : "";
    if (/[a-z0-9]/.test(after)) return false; // would split a word
    if (/[\s.,;:!?()"']/.test(after) === false) return false;
    if (after === "'" || after === "\u2019") return false;
    if (/[a-z0-9]/.test(before)) return false;
    if (/[,;:]/.test(before)) return false;
    const ws = k.split(" ");
    if (ws.length === 1 && ws[0].length < 5 && (a.phraseCounts.get(k) || 0) < 4) return false;
    if (ws.length === 1 && k.length < 5) return false;
    return true;
  });
  return clean.sort((x, y) => {
    const wx = x.split(" ").length;
    const wy = y.split(" ").length;
    if (wy !== wx) return wy - wx;
    return y.length - x.length;
  });
}

export function buildSummary(a: Analysis, title: string): string {
  const defs = defMap(a);
  const ranked = [...a.sentences]
    .filter((s) => s.text.length > 34 && s.text.length < 250 && !GENERIC_FILLER.test(s.text))
    .sort((x, y) => rankSentence(y, a.termByLower, defs) - rankSentence(x, a.termByLower, defs));
  const chosen = dedupe(ranked.slice(0, 5).map((s) => capitalise(tidy(s.text)))).map((s) => shorten(s, 220)).slice(0, 3);

  const parts: string[] = [];
  parts.push(`These notes cover **${title}** — about ${a.wordCount.toLocaleString()} words of source material.`);
  if (a.terms.length) {
    parts.push(
      `The material centres on ${a.terms
        .slice(0, 5)
        .map((t) => `**${t}**`)
        .join(", ")}${a.terms.length > 5 ? ` and ${a.terms.length - 5} other key concepts` : ""}.`
    );
  }
  if (chosen.length) parts.push(chosen.join(" "));
  if (a.facts.length) parts.push(`Worth memorising: ${a.facts[0]}`);
  return parts.join(" ");
}

export function buildFlashcards(a: Analysis, count = 14): Flashcard[] {
  const cards: Flashcard[] = [];
  const used = new Set<string>();

  const mk = (front: string, back: string, tags: string[], hint?: string): Flashcard => ({
    id: uid("card"),
    front: tidy(front),
    back: capitalise(tidy(back)),
    hint,
    tags,
    srs: { box: 1, due: Date.now(), reps: 0, lapses: 0 },
  });

  // 1 — definition cards
  for (const d of a.definitions) {
    if (cards.length >= count) break;
    const key = d.term.toLowerCase();
    if (used.has(key) || d.meaning.length < 14) continue;
    used.add(key);
    cards.push(
      mk(`What is ${d.term}?`, shorten(d.meaning, 300), ["definition", d.term], `Begins “${shorten(d.meaning, 26)}…”`)
    );
  }

  // 2 — cloze cards built from sentences carrying key terms
  const clozeCandidates = a.sentences
    .map((s) => ({ s, hits: clozeTargets(a, s.text) }))
    .filter((x) => x.hits.length && x.s.text.length > 50 && x.s.text.length < 230 && !GENERIC_FILLER.test(x.s.text))
    .sort((x, y) => y.hits.length - x.hits.length || y.s.text.length - x.s.text.length);

  for (const { s, hits } of clozeCandidates) {
    if (cards.length >= count) break;
    const target = hits[0];
    const display = a.termByLower.get(target) || target;
    const sentence = capitalise(tidy(s.text));
    const idx2 = sentence.toLowerCase().indexOf(target);
    if (idx2 < 0) continue;
    const blanked = `${sentence.slice(0, idx2)}______${sentence.slice(idx2 + target.length)}`;
    const key = `cloze:${blanked.toLowerCase()}`;
    if (used.has(key) || used.has(target)) continue;
    used.add(key);
    used.add(target);
    cards.push(mk(`Fill in the blank: ${shorten(blanked, 210)}`, display, ["cloze", display], `${display.length} letters`));
  }

  // 3 — "significance" cards for remaining top terms
  for (const term of a.terms) {
    if (cards.length >= count) break;
    const key = term.toLowerCase();
    if (used.has(key)) continue;
    const low = key;
    const s = a.sentences.find(
      (x) => x.text.toLowerCase().includes(low) && x.text.length > 55 && x.text.length < 250 && !GENERIC_FILLER.test(x.text)
    );
    if (!s) continue;
    used.add(key);
    cards.push(
      mk(
        `Explain the significance of ${term}.`,
        shorten(tidy(s.text), 300),
        ["concept", term],
        `It comes up in the part about ${headingOf(a, s).toLowerCase()}.`
      )
    );
  }

  // 4 — a fact card for flavour
  if (cards.length < count && a.facts.length) {
    cards.push(mk("Recall this key fact from the material.", shorten(a.facts[0], 240), ["fact"], "It involves a number or a date."));
  }

  return shuffle(cards).slice(0, Math.max(4, count));
}

export function buildQuestions(a: Analysis, count = 8, difficulty: DemoOptions["difficulty"] = "mixed"): Question[] {
  const questions: Question[] = [];
  const defs = defMap(a);
  const mcTarget = Math.max(2, Math.round(count * 0.4));
  const clozeTarget = Math.max(1, Math.round(count * 0.3));
  const openTarget = Math.max(1, Math.round(count * 0.25));
  const of = (t: Question["type"]) => questions.filter((q) => q.type === t).length;

  const mk = (q: Partial<Question>): Question => ({
    id: uid("q"),
    type: q.type || "mc",
    prompt: tidy(q.prompt || ""),
    options: q.options,
    answer: q.answer || "",
    answerIndex: q.answerIndex,
    explanation: q.explanation || "",
    source: q.source,
    difficulty: q.difficulty || "medium",
  });

  /* ---- multiple choice: which term matches this definition? ---- */
  for (const d of a.definitions) {
    if (of("mc") >= mcTarget) break;
    const distractors = dedupe(
      shuffle(
        a.definitions
          .filter((o) => o.term.toLowerCase() !== d.term.toLowerCase() && o.term.length < 40)
          .map((o) => o.term)
      )
    ).slice(0, 3);
    const extras = shuffle(
      a.terms.filter(
        (t) => t.toLowerCase() !== d.term.toLowerCase() && !distractors.some((x) => x.toLowerCase() === t.toLowerCase()) && t.length < 40
      )
    ).slice(0, Math.max(0, 3 - distractors.length));
    const opts = shuffle(dedupe([d.term, ...distractors, ...extras])).slice(0, 4);
    if (opts.length < 3) continue;
    questions.push(
      mk({
        type: "mc",
        prompt: `Which term matches this description? “${shorten(capitalise(d.meaning), 190)}”`,
        options: opts,
        answer: d.term,
        answerIndex: opts.indexOf(d.term),
        explanation: `**${d.term}** — ${shorten(capitalise(d.meaning), 200)}`,
        source: shorten(d.sentence.text, 190),
        difficulty: "easy",
      })
    );
  }

  /* ---- multiple choice: which statement is supported by the source? ---- */
  const important = a.sentences
    .map((s) => ({ s, score: rankSentence(s, a.termByLower, defs) }))
    .filter((x) => x.score >= 8 && x.s.text.length > 50 && x.s.text.length < 195 && !GENERIC_FILLER.test(x.s.text))
    .sort((x, y) => y.score - x.score);

  for (const { s } of important) {
    if (of("mc") >= mcTarget + 2) break;
    const termIn = a.terms.find((t) => s.text.toLowerCase().includes(t.toLowerCase()));
    if (!termIn) continue;
    const others = shuffle(
      a.sentences.filter((o) => o.text !== s.text && o.text.length > 45 && o.text.length < 195 && !GENERIC_FILLER.test(o.text))
    ).slice(0, 3);
    if (others.length < 2) continue;
    const correct = shorten(tidy(s.text), 165);
    const opts = dedupe(shuffle([correct, ...others.map((o) => shorten(tidy(o.text), 165))])).slice(0, 4);
    if (opts.length < 3 || !opts.includes(correct)) continue;
    questions.push(
      mk({
        type: "mc",
        prompt: `Which statement about **${termIn}** is supported by the source material?`,
        options: opts,
        answer: correct,
        answerIndex: opts.indexOf(correct),
        explanation: `Stated directly in the source, in the section on ${headingOf(a, s).toLowerCase()}.`,
        source: shorten(s.text, 190),
        difficulty: "medium",
      })
    );
  }

  /* ---- cloze ---- */
  const clozeCandidates = shuffle(a.sentences)
    .map((s) => ({ s, hits: clozeTargets(a, s.text) }))
    .filter((x) => x.hits.length && x.s.text.length > 50 && x.s.text.length < 225 && !GENERIC_FILLER.test(x.s.text));

  for (const { s, hits } of clozeCandidates) {
    if (of("cloze") >= clozeTarget) break;
    const target = hits[0];
    const display = a.termByLower.get(target) || target;
    const sentence = capitalise(tidy(s.text));
    const idx = sentence.toLowerCase().indexOf(target);
    if (idx < 0) continue;
    const prompt = shorten(`${sentence.slice(0, idx)}______${sentence.slice(idx + target.length)}`, 215);
    if (questions.some((q) => q.type === "cloze" && q.prompt === prompt)) continue;
    questions.push(
      mk({
        type: "cloze",
        prompt,
        answer: display,
        explanation: `The missing term is **${display}**.`,
        source: shorten(sentence, 190),
        difficulty: difficulty === "hard" ? "hard" : "medium",
      })
    );
  }

  /* ---- open ---- */
  const openStems = [
    (t: string) => `Explain the significance of ${t} in your own words.`,
    (t: string) => `How would you describe ${t} to a classmate who missed the lecture?`,
    (t: string) => `What is ${t}, and why does it matter here?`,
    (t: string) => `Give an example involving ${t} and explain how it works.`,
  ];
  for (const term of a.terms) {
    if (of("open") >= openTarget) break;
    const low = term.toLowerCase();
    const support = a.sentences.find(
      (s) => s.text.toLowerCase().includes(low) && s.text.length > 55 && s.text.length < 260 && !GENERIC_FILLER.test(s.text)
    );
    if (!support) continue;
    questions.push(
      mk({
        type: "open",
        prompt: openStems[of("open") % openStems.length](term),
        answer: shorten(tidy(support.text), 290),
        explanation: `A strong answer names ${term} and explains its role — see the section on ${headingOf(a, support).toLowerCase()}.`,
        source: shorten(support.text, 190),
        difficulty: difficulty === "hard" ? "hard" : "medium",
      })
    );
  }

  /* ---- top-up for very short sources ---- */
  if (questions.length < count) {
    for (const term of a.terms) {
      if (questions.length >= count) break;
      const support = a.sentences.find((s) => s.text.toLowerCase().includes(term.toLowerCase()));
      if (!support) continue;
      questions.push(
        mk({
          type: "open",
          prompt: `What do you remember about ${term}?`,
          answer: shorten(tidy(support.text), 250),
          explanation: `Search your notes for “${term}”.`,
          source: shorten(support.text, 180),
          difficulty: "easy",
        })
      );
    }
  }

  return shuffle(questions).slice(0, clamp(count, 3, 20));
}

const HOST_A = "Nova";
const HOST_B = "Miles";

export function buildPodcast(a: Analysis, title: string): { lines: PodcastLine[]; podcastTitle: string } {
  const lines: PodcastLine[] = [];
  const say = (speaker: "A" | "B", text: string) => lines.push({ speaker, text });
  const terms = a.terms.slice(0, 6);
  const defs = a.definitions.slice(0, 4);
  const sections = buildSections(a).slice(0, 4);
  const facts = a.facts.slice(0, 3);

  say("A", `Hey everyone, welcome back to Storm Sessions, the five minute study break that actually sticks. I'm ${HOST_A}.`);
  say("B", `And I'm ${HOST_B}. Today we're cracking open “${title}”, and honestly, this one is a great last-night-before-the-exam episode.`);
  say("A", `Let's set the scene. What is this material really about?`);
  if (terms.length) {
    say(
      "B",
      `At its core it comes down to a handful of ideas: ${terms.slice(0, 4).join(", ")}${terms.length > 4 ? `, and a few more` : ""}. If you remember nothing else from this episode, remember those.`
    );
  } else {
    say("B", `It's a fairly dense piece of material, so we're going to slow down and take it one idea at a time.`);
  }

  if (sections[0]) {
    say("A", `Let's start at the beginning. ${sections[0].heading}?`);
    say("B", sections[0].bullets.slice(0, 2).join(" "));
  }

  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    if (i === 0) say("A", `Okay, quiz time. ${HOST_B}, don't look at your notes — what exactly is ${d.term}?`);
    else say("A", `Next one. What is ${d.term}?`);
    say("B", `${capitalise(shorten(d.meaning, 220))}`);
    say("A", i % 2 === 0 ? `Nice, that's exactly right.` : `That's the one. Write that down verbatim, it's a classic exam definition.`);
  }

  if (sections[1]) {
    say("A", `Moving on — ${sections[1].heading}.`);
    say("B", sections[1].bullets.slice(0, 2).join(" "));
  }

  if (facts.length) {
    say("A", `Now for the numbers, because numbers are where marks get lost. ${facts[0]}`);
    if (facts[1]) say("B", `And don't forget this one either: ${facts[1]}`);
    say("A", `Pro tip — anything with a date or a figure in it is basically begging to be tested.`);
  }

  if (terms.length > 2) {
    say("B", `Here's the connection most people miss. ${terms[0]} and ${terms[1]} aren't separate topics — once you can explain how they link, the rest of the material falls into place.`);
    say("A", `That's the kind of thing that turns a memorised answer into a full-marks answer.`);
  }

  if (sections[2]) {
    say("A", `One more idea before we wrap — ${sections[2].heading}.`);
    say("B", sections[2].bullets.slice(0, 2).join(" "));
  }

  say("A", `So how should people revise this?`);
  say(
    "B",
    `Three passes. First, read the generated notes once so the structure is familiar. Second, run the flashcards until you can answer before the card flips. Third, do the quiz cold — no notes — and turn every miss into a new card.`
  );
  say("A", `Love it. That's the episode. Go get those marks — see you next time.`);
  say("B", `Happy studying, everyone.`);

  return {
    lines: lines.filter((l) => l.text && l.text.trim().length > 1),
    podcastTitle: `Storm Sessions — ${title}`,
  };
}

export function buildNotesMarkdown(a: Analysis, title: string, subject?: string): string {
  const sections = buildSections(a);
  const parts: string[] = [];
  parts.push(`# ${title}`);
  const meta = [
    subject ? `**Subject:** ${subject}` : null,
    `**Source length:** ~${a.wordCount} words`,
    `**Key concepts:** ${a.terms.length}`,
  ].filter(Boolean);
  parts.push(meta.join("  ·  "));
  parts.push("");
  parts.push("## Summary");
  parts.push(buildSummary(a, title));
  parts.push("");
  parts.push("## Key terms");
  const glossaryTerms = [...a.terms].sort((x, y) => {
    const dx = a.definitions.some((d) => d.term.toLowerCase() === x.toLowerCase()) ? 1 : 0;
    const dy = a.definitions.some((d) => d.term.toLowerCase() === y.toLowerCase()) ? 1 : 0;
    return dy - dx;
  });
  const termsWithDef = glossaryTerms.slice(0, 14).map((t) => {
    const d = a.definitions.find((x) => x.term.toLowerCase() === t.toLowerCase());
    const gloss = d ? shorten(capitalise(d.meaning), 180) : shorten(findContext(a, t), 180);
    return `- **${t}** — ${gloss}`;
  });
  parts.push(termsWithDef.join("\n"));
  parts.push("");
  parts.push("## Study notes");
  for (const s of sections) {
    parts.push(`### ${s.heading}`);
    for (const b of s.bullets) parts.push(`- ${b}`);
    parts.push("");
  }
  if (a.facts.length) {
    parts.push("## Numbers & dates worth memorising");
    for (const f of a.facts.slice(0, 6)) parts.push(`- ${f}`);
    parts.push("");
  }
  parts.push("## Quick recall");
  for (const q of buildQuestions(a, 5).slice(0, 5)) {
    parts.push(`- ${q.prompt.replace(/\*\*/g, "")} — *${q.answer}*`);
  }
  parts.push("");
  parts.push("---");
  parts.push("*Generated by StormLearn. Edit anything — your notes, your rules.*");
  return parts.join("\n");
}

export function generateFromText(text: string, opts: DemoOptions): GeneratedContent {
  const a = analyze(text);
  const title = opts.title || "Untitled study set";
  const cardCount = clamp(opts.cards ?? 14, 4, 40);
  const questionCount = clamp(opts.questions ?? 8, 3, 20);
  const { lines, podcastTitle } = buildPodcast(a, title);

  const ordered = [...a.terms].sort((x, y) => {
    const dx = a.definitions.some((d) => d.term.toLowerCase() === x.toLowerCase()) ? 1 : 0;
    const dy = a.definitions.some((d) => d.term.toLowerCase() === y.toLowerCase()) ? 1 : 0;
    return dy - dx;
  });
  const keyTerms: KeyTerm[] = ordered.slice(0, 16).map((t) => {
    const d = a.definitions.find((x) => x.term.toLowerCase() === t.toLowerCase());
    return { term: t, definition: d ? shorten(capitalise(d.meaning), 220) : shorten(findContext(a, t), 220) };
  });

  return {
    summary: buildSummary(a, title),
    outline: a.outline,
    keyTerms,
    facts: a.facts,
    sections: buildSections(a),
    notesMarkdown: buildNotesMarkdown(a, title),
    flashcards: buildFlashcards(a, cardCount),
    questions: buildQuestions(a, questionCount, opts.difficulty),
    podcast: lines,
    podcastTitle,
  };
}

/* ------------------------------ tutor (chat) ----------------------------- */

export interface ExtractiveAnswer {
  answer: string;
  citations: string[];
}

export function answerFromText(text: string, question: string): ExtractiveAnswer {
  const a = analyze(text);
  const defs = defMap(a);
  const qLow = question.toLowerCase();
  const qTokens = [...new Set(wordList(question).filter((w) => !STOPWORDS.has(w) && w.length > 2))];
  const termHits = a.terms.filter((t) => qLow.includes(t.toLowerCase()));

  const scored = a.sentences
    .map((s) => {
      const low = s.text.toLowerCase();
      let score = 0;
      for (const tok of qTokens) if (low.includes(tok)) score += 2;
      for (const t of termHits) if (low.includes(t.toLowerCase())) score += 6;
      if (DEFINITIONAL_CUE.test(low)) score += 2;
      score += rankSentence(s, a.termByLower, defs) * 0.35;
      if (/\?/.test(s.text)) score -= 3;
      if (GENERIC_FILLER.test(s.text)) score -= 4;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);

  const best = dedupe(scored.slice(0, 3).map((x) => capitalise(tidy(x.s.text))));
  // Prefer the most specific (longest) matching concept, so "What is an AVL
  // tree?" resolves to AVL tree rather than tree.
  const relatedTerm =
    [...termHits].sort((x, y) => y.length - x.length)[0] ||
    a.terms.find((t) => qTokens.some((q) => t.toLowerCase().includes(q) || q.includes(t.toLowerCase())));
  const def = relatedTerm ? defs.get(relatedTerm.toLowerCase()) : undefined;

  const parts: string[] = [];
  if (def) parts.push(`**${def.term}** — ${shorten(capitalise(def.meaning), 260)}`);
  if (best.length) {
    parts.push(`From your source material:\n\n${best.map((b) => `> ${shorten(b, 300)}`).join("\n>\n")}`);
  }
  if (!parts.length) {
    parts.push(
      `I couldn't find a direct answer to that in this study set. Try rephrasing with one of its key terms — ${
        a.terms.slice(0, 5).join(", ") || "or add more source text"
      } — or switch on an AI provider in Settings for open-ended answers.`
    );
  } else {
    parts.push(
      "_Answered extractively from your source. Add an AI provider in **Settings** for conversational, open-ended answers._"
    );
  }

  return { answer: parts.join("\n\n"), citations: best };
}
