import fs from "node:fs";
import path from "node:path";
import { containsQuote } from "../src/lib/core/normalize";
const root = path.resolve(__dirname, "..");
const kb = JSON.parse(fs.readFileSync(path.join(root, "kb/rules.json"), "utf8"));
const snapDir = path.join(root, "kb/snapshots");
const cache: Record<string, string | null> = {};
let fail = 0, checked = 0, missing = 0;
const counts: Record<string, number> = {};
for (const r of kb.rules) for (const e of r.excerpts) {
  counts[e.verification] = (counts[e.verification] || 0) + 1;
  if (e.verification === "paraphrase") continue;
  const f = path.join(snapDir, e.snapshot);
  if (!(e.snapshot in cache)) cache[e.snapshot] = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  const txt = cache[e.snapshot];
  if (txt == null) { missing++; continue; }
  checked++;
  if (!containsQuote(txt, e.text)) { fail++; console.log(`FAIL ${r.id} [${e.snapshot}] ${e.text.slice(0, 90)}`); }
}
const rulesV = kb.rules.filter((r: any) => r.excerpts.some((e: any) => e.verification !== "paraphrase")).length;
console.log(JSON.stringify({ version: kb.version, rules: kb.rules.length, rules_with_verified_excerpt: rulesV, excerpts: counts, checked, failed: fail, snapshots_missing: missing }));
process.exit(fail ? 1 : 0);
