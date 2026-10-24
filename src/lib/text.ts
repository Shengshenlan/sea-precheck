/** Text helpers shared by the result views: URL shortening and Thai-script detection. */

/** http(s) URL inside running text; stops at whitespace, quotes and CJK / full-width punctuation. */
export const URL_RE = /https?:\/\/[^\s\u3000-\u303F\uFF00-\uFFEF\u4E00-\u9FFF"'<>]+/g;
/** A run of Thai characters plus the dots / spaces that belong to it (e.g. “มอก.”, “สมอ.”). */
export const THAI_RE = /[\u0E00-\u0E7F]+\.?/g;

/** Splits trailing sentence punctuation off a matched URL so it is not part of the link. */
export function trimUrl(raw: string): { url: string; rest: string } {
  const m = raw.match(/[.,;:!?)\]]+$/);
  return m ? { url: raw.slice(0, -m[0].length), rest: m[0] } : { url: raw, rest: "" };
}

/** “https://www.anyregis.nbtc.go.th/rces/x?y=1” → “anyregis.nbtc.go.th/…”; a bare host stays as is. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const deep = (u.pathname && u.pathname !== "/") || u.search || u.hash;
    return deep ? `${host}/…` : host;
  } catch { return url.length > 28 ? `${url.slice(0, 27)}…` : url; }
}

/** Remove Thai script from a name (keeps the Latin / Chinese main name): “TISI มอก. 685-1” → “TISI 685-1”. */
export function stripThai(s: string): string {
  return s.replace(THAI_RE, "").replace(/（\s*）|\(\s*\)/g, "").replace(/\s{2,}/g, " ").replace(/\s+([）)，、])/g, "$1").trim();
}
