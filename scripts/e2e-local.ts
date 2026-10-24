/**
 * Local end-to-end check of the full user flow against a `wrangler dev` worker with DEV_MAIL_LOG=1.
 *   npx tsx scripts/e2e-local.ts [--api http://127.0.0.1:8787] [--image /path/a.jpg[,/path/b.jpg,…up to 5]] [--info-chars 10000]
 * Steps: send-code → register → login → reset (old token revoked) → 3-country check → history → delete → logout.
 * Never prints tokens or keys; dev codes only exist in local dev-mail mode.
 */
import { readFileSync } from "node:fs";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const API = arg("--api", "http://127.0.0.1:8787").replace(/\/$/, "");
const IMAGES = arg("--image", "/workspace/pack.jpg").split(",").filter(Boolean);
const INFO_CHARS = parseInt(arg("--info-chars", "0"), 10);
const email = `e2e+${Date.now()}@example.com`;
let pass = 0, fail = 0;
const ok = (cond: unknown, label: string, extra = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); };

async function call(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  const r = await fetch(API + path, {
    method: init.method || (init.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return { status: r.status, j: (await r.json().catch(() => ({}))) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function main() {
  console.log(`API ${API}  user ${email}`);
  // --- register ---
  let r = await call("/api/auth/send-code", { body: { email, purpose: "register" } });
  ok(r.status === 200 && /^\d{6}$/.test(r.j.dev_code || ""), "send-code(register) → dev code", `cooldown=${r.j.cooldown}`);
  const regCode = r.j.dev_code as string;
  r = await call("/api/auth/send-code", { body: { email, purpose: "register" } });
  ok(r.status === 429 && r.j.code === "cooldown", "resend within 60s → 429 cooldown", r.j.message);
  r = await call("/api/auth/register", { body: { email, code: "000000" === regCode ? "111111" : "000000", password: "Passw0rd123" } });
  ok(r.status === 400 && /还可尝试 4 次/.test(r.j.message), "wrong code → attempts left", r.j.message);
  r = await call("/api/auth/register", { body: { email, code: regCode, password: "short" } });
  ok(r.status === 400 && r.j.code === "weak_password", "weak password rejected", r.j.message);
  r = await call("/api/auth/register", { body: { email, code: regCode, password: "Passw0rd123", website: "x" } });
  ok(r.status === 400 && r.j.code === "bot", "honeypot rejected");
  r = await call("/api/auth/register", { body: { email, code: regCode, password: "Passw0rd123" } });
  ok(r.status === 200 && r.j.token, "register with code → logged in");
  const tok1 = r.j.token as string;
  r = await call("/api/auth/register", { body: { email, code: regCode, password: "Passw0rd123" } });
  ok(r.status === 409, "register again → 409 已注册", `${r.status} ${r.j.message || ""}`);
  r = await call("/api/auth/send-code", { body: { email, purpose: "register" } });
  ok(r.status === 409, "send-code(register) for existing email → 409");
  // 5 wrong attempts lock the code
  const e2 = `e2e-lock+${Date.now()}@example.com`;
  const c2 = (await call("/api/auth/send-code", { body: { email: e2, purpose: "register" } })).j.dev_code as string;
  const wrong = c2 === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await call("/api/auth/register", { body: { email: e2, code: wrong, password: "Passw0rd123" } });
  r = await call("/api/auth/register", { body: { email: e2, code: c2, password: "Passw0rd123" } });
  ok(r.status === 400 && /次数过多/.test(r.j.message), "after 5 wrong attempts even the right code is refused", r.j.message);
  // --- login ---
  r = await call("/api/auth/login", { body: { email, password: "wrongpass1" } });
  ok(r.status === 401, "login wrong password → 401");
  r = await call("/api/auth/login", { body: { email, password: "Passw0rd123" } });
  ok(r.status === 200 && r.j.token, "login");
  r = await call("/api/auth/me", { token: tok1 });
  ok(r.status === 200 && r.j.user?.email === email, "me", `quota ${r.j.quota?.used}/${r.j.quota?.limit}`);
  // --- forgot password ---
  r = await call("/api/auth/send-code", { body: { email: `nobody${Date.now()}@example.com`, purpose: "reset" } });
  ok(r.status === 200 && !r.j.dev_code, "reset for unknown email → generic ok, no code");
  r = await call("/api/auth/send-code", { body: { email, purpose: "reset" } });
  ok(r.status === 200 && r.j.dev_code, "send-code(reset)");
  r = await call("/api/auth/reset", { body: { email, code: r.j.dev_code, password: "NewPassw0rd9" } });
  ok(r.status === 200 && r.j.token, "reset password with code");
  const tok2 = r.j.token as string;
  ok((await call("/api/auth/me", { token: tok1 })).status === 401, "old token revoked after reset");
  ok((await call("/api/auth/login", { body: { email, password: "Passw0rd123" } })).status === 401, "old password rejected");
  ok((await call("/api/auth/login", { body: { email, password: "NewPassw0rd9" } })).status === 200, "new password works");
  // --- check: 3 countries + image ---
  const imgs = IMAGES.map((f) => `data:image/${/\.png$/i.test(f) ? "png" : /\.webp$/i.test(f) ? "webp" : "jpeg"};base64,${readFileSync(f).toString("base64")}`);
  let info = "儿童电动玩具车 遥控 3岁以上\n使用 4 节 AA 碱性干电池，塑料材质";
  if (INFO_CHARS) { const more = "。产品详情：塑料车身，遥控距离10米，附带说明书与保修卡，适合室内外玩耍，请在成人监护下使用，小零件注意防止误吞。"; while (info.length < INFO_CHARS) info += more; info = info.slice(0, INFO_CHARS); }
  console.log(`      sending ${imgs.length} image(s), ${(imgs.reduce((a, s) => a + s.length, 0) / 1048576).toFixed(1)}MB base64, ${info.length} chars of text`);
  const t0 = Date.now();
  r = await call("/api/check", { token: tok2, body: { info, countries: ["TH", "PH", "MY"], images: imgs } });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  ok(r.status === 200 && r.j.ok && ["TH", "PH", "MY"].every((c) => r.j.results?.[c]), `check TH+PH+MY with ${imgs.length} image(s) (${secs}s)`, `image_facts=${r.j.image_facts ? "yes" : "no"} failed=${r.j.shared?.images_failed ?? 0} ${r.j.image_error || ""}`);
  console.log(`      timings: total=${secs}s worker latency_ms=${r.j.shared?.latency_ms ?? r.j.latency_ms ?? "?"} vision_ms=${r.j.shared?.vision_ms ?? r.j.vision_ms ?? "?"}`);
  for (const c of ["TH", "PH", "MY"]) {
    const x = r.j.results?.[c] || {};
    const rules: string[] = [...(x.items || []), ...(x.extra_rule_ids || [])];
    console.log(`      ${c}: ok=${x.ok} category=${x.category ?? "-"} rules=${rules.length} lithiumRule=${rules.some((id) => /LIBAT|TISI-BATTERY/.test(id))}`);
  }
  const checkId = r.j.check_id;
  // --- history ---
  r = await call("/api/history", { token: tok2 });
  ok(r.status === 200 && r.j.items?.[0]?.id === checkId && r.j.items[0].countries?.length === 3, "history list", JSON.stringify(r.j.items?.[0]?.verdicts || {}));
  r = await call(`/api/history/${checkId}`, { token: tok2 });
  ok(r.status === 200 && r.j.item?.result?.results?.MY, "history item has full result");
  r = await call(`/api/history/${checkId}`, { token: tok2, method: "DELETE" });
  ok(r.status === 200 && r.j.deleted === 1, "history delete");
  ok((await call("/api/history", { token: tok2 })).j.items?.length === 0, "history empty after delete");
  // --- logout = client discards the token; unauthenticated calls are refused ---
  ok((await call("/api/history")).status === 401, "no token → history 401");
  ok((await call("/api/check", { body: { info: "x", countries: ["TH"] } })).status === 401, "no token → check 401");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
