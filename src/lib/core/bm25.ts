import type { Rule } from "./types";
export function tokenize(s: string): string[] {
  const t = s.toLowerCase().normalize("NFKC");
  const out: string[] = [];
  for (const m of t.matchAll(/[a-z0-9]+|[\u4e00-\u9fff]+|[\u0e00-\u0e7f]+/g)) {
    const w = m[0];
    if (/^[\u4e00-\u9fff]+$/.test(w)) { if (w.length === 1) out.push(w); for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2)); }
    else if (/^[\u0e00-\u0e7f]+$/.test(w)) { for (let i = 0; i < w.length - 2; i += 2) out.push(w.slice(i, i + 3)); }
    else out.push(w);
  }
  return out;
}
export class BM25 {
  private docs: string[][]; private df = new Map<string, number>(); private avg: number;
  constructor(private rules: Rule[], private k1 = 1.4, private b = 0.75) {
    this.docs = rules.map((r) => tokenize([r.id, r.title, r.cert, r.authority, r.requirement, r.items.join(" "), ...r.excerpts.map((e) => e.text)].join(" ")));
    for (const d of this.docs) for (const w of new Set(d)) this.df.set(w, (this.df.get(w) || 0) + 1);
    this.avg = this.docs.reduce((a, d) => a + d.length, 0) / Math.max(1, this.docs.length);
  }
  search(q: string, k = 5, filter?: (r: Rule) => boolean): { rule: Rule; score: number }[] {
    const qt = [...new Set(tokenize(q))]; const N = this.docs.length;
    return this.docs.map((d, i) => {
      if (filter && !filter(this.rules[i])) return { rule: this.rules[i], score: 0 };
      let s = 0; const tf = new Map<string, number>(); for (const w of d) tf.set(w, (tf.get(w) || 0) + 1);
      for (const w of qt) { const f = tf.get(w); if (!f) continue; const df = this.df.get(w)!;
        s += Math.log(1 + (N - df + 0.5) / (df + 0.5)) * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * d.length / this.avg)); }
      return { rule: this.rules[i], score: s };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
  }
}
