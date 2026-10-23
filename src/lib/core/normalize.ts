/** Whitespace/punctuation-insensitive normalization used for exact-substring quote checks. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u0e4d\u0e32/g, "\u0e33") // Thai sara am decomposed (PDF extraction) -> composed
    .replace(/[\s\u200b\u00a0]+/g, "")
    .toLowerCase();
}
export function containsQuote(haystack: string, quote: string): boolean {
  const q = normalizeForMatch(quote);
  return q.length >= 6 && normalizeForMatch(haystack).includes(q);
}
