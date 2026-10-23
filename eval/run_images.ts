/**
 * Image eval (synthetic packaging photos): npx tsx eval/run_images.ts --api http://127.0.0.1:8788 [--label x]
 * Measures the vision step (marks/brands/wireless/battery/label language) and the end-to-end pipeline
 * (category, mandatory-cert set vs KB ground truth, guard on "Cordless" ≠ wireless). n=6 — tiny sample, indicative only.
 */
import fs from "node:fs";
import path from "node:path";
import { buildReport, imageEvidenceText } from "../src/lib/core/match";
import samples from "./image_samples.json";
import { getToken } from "./client";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const API = arg("--api") || "http://127.0.0.1:8788"; const label = arg("--label") || "vision";
const certIds = (r: any) => new Set<string>(r.certs.filter((h: any) => h.rule.mandatory && h.rule.kind === "cert").map((h: any) => h.rule.id));
const up = (a: string[] = []) => new Set(a.map((x) => x.toUpperCase()));
const lc = (a: string[] = []) => new Set(a.map((x) => x.toLowerCase()));
const eq = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

async function main() {
  const token = await getToken(API, process.env.EVAL_EMAIL || "eval@example.com", process.env.EVAL_PASSWORD || "Eval2026pass");
  const rows: any[] = [];
  for (const x of samples as any[]) {
    const img = "data:image/jpeg;base64," + fs.readFileSync(path.join(__dirname, "images", x.file)).toString("base64");
    const input = { title: x.title, description: "", country: x.country, platform: x.platform, category: "auto" } as any;
    const t0 = Date.now(); let b: any = {};
    for (let a = 0; a < 3; a++) {
      const r = await fetch(`${API}/api/check`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ ...input, images: [img] }), signal: AbortSignal.timeout(90000) }).catch(() => null);
      b = r ? await r.json().catch(() => ({})) : { code: "network" };
      if (b.code !== "busy") break; await new Promise((s) => setTimeout(s, 20000));
    }
    const f = b.image_facts || {}; const g = x.gt;
    const gtCerts = certIds(buildReport({ ...input, category: g.category }, { items: g.items, features: g.features }));
    const rep: any = b.ok ? buildReport(input, { category: b.category, features: b.features, items: b.items, extraRuleIds: b.extra_rule_ids, imageText: b.image_facts ? imageEvidenceText(b.image_facts) : "" }) : null;
    const pred = rep ? certIds(rep) : new Set<string>();
    const gm = up(g.marks), pm = up(f.marks);
    rows.push({
      id: x.id, ok: !!b.ok, failure: b.ok ? null : b.code || "error", image_error: b.image_error || null, latency_ms: Date.now() - t0, vision_ms: b.vision_ms ?? null,
      marks_gt: [...gm], marks_pred: [...pm], marks_tp: [...gm].filter((m) => pm.has(m)).length, marks_fp: [...pm].filter((m) => !gm.has(m)).length,
      brands_ok: g.brands.every((br: string) => (f.brands || []).some((p: string) => p.toLowerCase().includes(br.toLowerCase()))) && (g.brands.length > 0 || true),
      brand_hit_image: (rep?.brand?.hits || []).some((h: any) => h.source === "image"), brands_gt: g.brands, brands_pred: f.brands || [],
      wireless_ok: f.wireless === g.wireless, wireless_lenient: (f.wireless === true) === g.wireless, wireless_pred: f.wireless,
      battery_ok: f.battery === g.battery, battery_lenient: (f.battery === true) === g.battery, battery_pred: f.battery,
      langs_exact: eq(lc(g.label_langs), lc(f.label_langs)), langs_gt: g.label_langs, langs_pred: f.label_langs,
      category_ok: b.category === g.category, category_pred: b.category,
      certs_gt: [...gtCerts], certs_pred: [...pred], certs_tp: [...gtCerts].filter((c) => pred.has(c)).length, certs_fp: [...pred].filter((c) => !gtCerts.has(c)).length,
      features_pred: b.features || [], wireless_feature_pred: (b.features || []).includes("wireless"), guard_removed: b.guard_removed || [],
    });
    process.stderr.write(`${x.id} ${b.ok ? "ok" : b.code} ${Date.now() - t0}ms\n`);
  }
  const n = rows.length, ok = rows.filter((r) => r.ok);
  const sum = (k: string) => rows.reduce((s, r) => s + r[k], 0); const cnt = (k: string) => rows.filter((r) => r[k]).length;
  const mTP = sum("marks_tp"), mGT = rows.reduce((s, r) => s + r.marks_gt.length, 0), mFP = sum("marks_fp");
  const cTP = sum("certs_tp"), cGT = rows.reduce((s, r) => s + r.certs_gt.length, 0), cFP = sum("certs_fp");
  const vac = rows.find((r) => r.id === "img-my-vacuum");
  const summary = {
    label, n, ok: ok.length,
    marks_recall: +(mTP / Math.max(1, mGT)).toFixed(3), marks_precision: +(mTP / Math.max(1, mTP + mFP)).toFixed(3),
    brand_detect_ok: cnt("brands_ok"), wireless_ok: cnt("wireless_ok"), wireless_lenient_ok: cnt("wireless_lenient"), battery_ok: cnt("battery_ok"), battery_lenient_ok: cnt("battery_lenient"), // lenient: null ("unsure") counts as "not claimed"
     label_langs_exact: cnt("langs_exact"),
    category_ok: cnt("category_ok"), cert_recall: +(cTP / Math.max(1, cGT)).toFixed(3), cert_precision: +(cTP / Math.max(1, cTP + cFP)).toFixed(3),
    vacuum_cordless_not_wireless: vac ? !vac.wireless_feature_pred : null,
    vision_ms_p50: ok.map((r) => r.vision_ms).sort((a, b) => a - b)[Math.floor(ok.length / 2)] ?? null,
  };
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results", `images-${label}.json`), JSON.stringify({ summary, rows }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
}
main();
