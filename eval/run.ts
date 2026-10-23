/**
 * Eval: npx tsx eval/run.ts --api http://127.0.0.1:8788 --label glm-4.5-flash [--concurrency 1]  (one account allows only 1 check in flight)
 *       npx tsx eval/run.ts --baseline   (deterministic rules only, no LLM)
 * AI checks need login: uses EVAL_EMAIL/EVAL_PASSWORD (default eval@example.com, local D1 only; registers if missing).
 * Ground truth is KB-derived: buildReport() with the hand-labelled category/items/features of each sample.
 */
import fs from "node:fs";
import { buildReport } from "../src/lib/core/match";
import { validateNote } from "../src/lib/core/validate";
import { candidateRules } from "../src/lib/core/match";
import samples from "./samples.json";
import { getToken } from "./client";
let TOKEN = "";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const API = arg("--api"); const baseline = process.argv.includes("--baseline");
const label = arg("--label") || (baseline ? "baseline-rules" : "llm"); const conc = parseInt(arg("--concurrency") || "1", 10);
const certIds = (r: any) => new Set<string>(r.certs.filter((h: any) => h.rule.mandatory && h.rule.kind === "cert").map((h: any) => h.rule.id));

async function one(x: any) {
  const input = { title: x.title, description: "", country: x.country, platform: x.platform, category: "auto" } as any;
  const gt = certIds(buildReport({ ...input, category: x.gt.category }, { items: x.gt.items, features: x.gt.features }));
  let t0 = Date.now(); let llm: any = null; let failure: string | null = null; let retries = 0;
  if (!baseline) {
    for (let attempt = 0; attempt < 4; attempt++) {
    failure = null; t0 = Date.now();
    try {
      const res = await fetch(`${API}/api/check`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(input), signal: AbortSignal.timeout(70000) });
      const b: any = await res.json().catch(() => ({}));
      if (res.ok && b.ok) llm = b; else failure = b.code || `http_${res.status}`;
    } catch (e: any) { failure = e.name === "TimeoutError" ? "client_timeout" : "network"; }
    if (failure !== "busy") break;
    retries++; await new Promise((r) => setTimeout(r, 20000 * (attempt + 1))); // upstream 1302 rate limit: back off
    }
  }
  const rep = llm ? buildReport(input, { category: llm.category, features: llm.features, items: llm.items, extraRuleIds: llm.extra_rule_ids }) : buildReport(input);
  const pred = certIds(rep);
  const predRaw = llm?.features_suggested ? certIds(buildReport(input, { category: llm.category, features: llm.features_suggested, items: llm.items, extraRuleIds: llm.extra_rule_ids_suggested })) : pred;
  const tpRaw = [...predRaw].filter((i) => gt.has(i)).length;
  const tp = [...pred].filter((i) => gt.has(i)).length;
  // re-validate citations client-side, like the UI does
  const allowed = new Set(candidateRules(x.country, rep.category ?? x.gt.category).map((r) => r.id));
  const notes = llm ? llm.notes.map((n: any) => validateNote(n, allowed)) : [];
  const bad = notes.filter((n: any) => n.status !== "verified").length;
  return { id: x.id, country: x.country, cat_gt: x.gt.category, cat_pred: rep.category, gt: [...gt], pred: [...pred], tp, pred_unguarded: [...predRaw], tp_unguarded: tpRaw, guard_removed: llm?.guard_removed || [],
    notes: notes.length, bad_notes: bad, dropped: llm?.dropped ?? 0, review: rep.review.length, needs_review_any: rep.review.length > 0 || rep.risk.level === "待复核",
    brand_gt: x.brand, brand_pred: rep.brand.hits.length > 0,
    risk: rep.risk.level, latency_ms: baseline ? 0 : Date.now() - t0, busy_retries: retries, failure, impl: llm?.impl, tools: llm?.tool_calls };
}

async function main() {
if (!baseline) TOKEN = await getToken(API!, process.env.EVAL_EMAIL || "eval@example.com", process.env.EVAL_PASSWORD || "Eval2026pass");
const out: any[] = []; let idx = 0;
await Promise.all(Array.from({ length: baseline ? 1 : conc }, async () => { while (idx < samples.length) { const x = (samples as any[])[idx++]; const r = await one(x); out.push(r); process.stderr.write(`${r.id} ${r.failure || "ok"} ${r.latency_ms}ms\n`); } }));
out.sort((a, b) => a.id.localeCompare(b.id));
const sum = (f: (r: any) => number) => out.reduce((s, r) => s + f(r), 0);
const P = sum((r) => r.pred.length), G = sum((r) => r.gt.length), TP = sum((r) => r.tp);
const lat = out.filter((r) => !r.failure && r.latency_ms).map((r) => r.latency_ms).sort((a, b) => a - b);
const q = (p: number) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : 0;
const brandTP = out.filter((r) => r.brand_gt && r.brand_pred).length;
const metrics = {
  label, n: out.length, when: new Date().toISOString(),
  cert_recall: +(TP / G).toFixed(3), cert_precision: +(P ? TP / P : 1).toFixed(3),
  exact_cert_match: out.filter((r) => r.tp === r.gt.length && r.pred.length === r.gt.length).length,
  unguarded: { cert_recall: +(sum((r) => r.tp_unguarded) / G).toFixed(3), cert_precision: +(sum((r) => r.tp_unguarded) / Math.max(1, sum((r) => r.pred_unguarded.length))).toFixed(3),
    exact_cert_match: out.filter((r) => r.tp_unguarded === r.gt.length && r.pred_unguarded.length === r.gt.length).length },
  guard_removed_total: sum((r) => r.guard_removed.length),
  category_acc: +(out.filter((r) => r.cat_pred === r.cat_gt).length / out.length).toFixed(3),
  notes_total: sum((r) => r.notes), notes_unverified: sum((r) => r.bad_notes), notes_dropped_bad_rule_id: sum((r) => r.dropped),
  hallucinated_citation_rate: +((sum((r) => r.bad_notes) + sum((r) => r.dropped)) / Math.max(1, sum((r) => r.notes) + sum((r) => r.dropped))).toFixed(3),
  review_rate: +(out.filter((r) => r.needs_review_any).length / out.length).toFixed(3),
  brand_recall: `${brandTP}/${out.filter((r) => r.brand_gt).length}`, brand_false_pos: out.filter((r) => !r.brand_gt && r.brand_pred).length,
  busy_retries: sum((r) => r.busy_retries || 0),
  failures: out.filter((r) => r.failure).length, failure_codes: out.filter((r) => r.failure).map((r) => `${r.id}:${r.failure}`),
  latency_ms: { p50: q(0.5), p90: q(0.9), max: lat.at(-1) || 0 },
};
fs.mkdirSync("eval/results", { recursive: true });
fs.writeFileSync(`eval/results/${label}.json`, JSON.stringify({ metrics, rows: out }, null, 1));
console.log(JSON.stringify(metrics, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
