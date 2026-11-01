/** Server-safe helpers (no DOM, no "use client"). */

export function shortenLocal(s: string, n: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= n) return clean;
  const cut = clean.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return `${cut.slice(0, sp > n * 0.4 ? sp : n).replace(/[,;:]$/, "")}…`;
}
