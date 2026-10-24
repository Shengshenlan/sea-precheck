/**
 * Local end-to-end test of the usage limits (no LLM calls: CHECK_DRY_RUN_LOCAL=1, honoured on loopback only).
 *   npm run test:e2e:limits            (needs Node 22 + `cd worker && npm ci`)
 * Starts its own `wrangler dev` instances on fresh local D1 state with LOW override values:
 *   phase A: CHECKS_PER_USER_PER_DAY=2, CHECKS_GLOBAL_PER_DAY=3  → per-account cap, site-wide cap, in-flight lock, input caps
 *   phase B: CHECKS_PER_IP_PER_DAY=2                             → per-IP cap
 *   phase C: MAIL_GLOBAL_PER_DAY=2 (RATE_LIMIT_DISABLED_LOCAL unset) → site-wide email cap
 * Never prints tokens or keys.
 */
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const WORKER = join(__dirname, "..", "worker");
let pass = 0, fail = 0;
const ok = (cond: unknown, label: string, extra = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function startWorker(port: number, vars: Record<string, string>): Promise<{ api: string; stop: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), "sea-limits-"));
  execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "sea-precheck", "--local", "--persist-to", dir], { cwd: WORKER, stdio: "ignore", env: { ...process.env, CI: "1" } });
  const all = { JWT_SECRET: randomBytes(32).toString("base64"), DEV_MAIL_LOG: "1", CHECK_DRY_RUN_LOCAL: "1", ...vars };
  const args = ["wrangler", "dev", "--port", String(port), "--ip", "127.0.0.1", "--persist-to", dir, ...Object.entries(all).flatMap(([k, v]) => ["--var", `${k}:${v}`])];
  const p: ChildProcess = spawn("npx", args, { cwd: WORKER, stdio: ["ignore", openSync(join(dir, "wrangler.log"), "w"), "inherit"], env: { ...process.env, CI: "1" }, detached: true });
  const api = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(api + "/api/health")).ok) break; } catch { /* starting */ } await sleep(500); }
  return { api, stop: () => { try { process.kill(-p.pid!, "SIGTERM"); } catch { /* gone */ } rmSync(dir, { recursive: true, force: true }); } };
}

function client(api: string) {
  const call = async (path: string, init: { body?: unknown; token?: string } = {}) => {
    const r = await fetch(api + path, { method: init.body ? "POST" : "GET", headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) }, body: init.body ? JSON.stringify(init.body) : undefined });
    return { status: r.status, j: (await r.json().catch(() => ({}))) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const register = async (tag: string) => {
    const email = `limits-${tag}+${Date.now()}@example.com`;
    const code = (await call("/api/auth/send-code", { body: { email, purpose: "register" } })).j.dev_code;
    const r = await call("/api/auth/register", { body: { email, code, password: "Passw0rd123" } });
    if (!r.j.token) throw new Error(`register failed: ${r.status} ${JSON.stringify({ ...r.j, token: undefined })} sendcode=${code ? "ok" : "missing"}`);
    return r.j.token as string;
  };
  const check = (token: string, extra: Record<string, unknown> = {}) => call("/api/check", { token, body: { info: "电热水壶 1.7L 220V 不锈钢", countries: ["TH", "PH", "MY"], ...extra } });
  return { call, register, check };
}

async function phaseA() {
  console.log("\n— phase A: per-account 2/day, site-wide 3/day —");
  const w = await startWorker(18791, { CHECKS_PER_USER_PER_DAY: "2", CHECKS_PER_IP_PER_DAY: "100", CHECKS_GLOBAL_PER_DAY: "3", RATE_LIMIT_DISABLED_LOCAL: "1" });
  try {
    const { call, register, check } = client(w.api);
    const a = await register("a"), b = await register("b");
    let r = await call("/api/auth/me", { token: a });
    ok(r.j.quota?.used === 0 && r.j.quota?.limit === 2, "me reports quota 0/2", JSON.stringify(r.j.quota));
    // input caps (rejected before any quota is spent)
    r = await check(a, { countries: ["TH", "PH", "MY", "TH"] });
    ok(r.status === 400 && r.j.code === "bad_country", "more than 3 countries → 400", r.j.message);
    r = await check(a, { info: "长".repeat(10001) });
    ok(r.status === 413 && r.j.code === "too_long", "商品信息 > 10000 字 → 413", r.j.message);
    const px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    r = await check(a, { images: Array(6).fill(px) });
    ok(r.status === 400 && r.j.code === "bad_image", "6 images → 400", r.j.message);
    r = await check(a, { images: [`data:image/jpeg;base64,${Buffer.alloc(5 * 1024 * 1024 + 10).toString("base64")}`] });
    ok(r.status === 400 && r.j.code === "bad_image" && /5MB/.test(r.j.message), "image > 5MB → 400 「单张图片不能超过 5MB」", r.j.message);
    const six = `data:image/jpeg;base64,${Buffer.alloc(4_800_000).toString("base64")}`;
    r = await check(a, { images: [six, six, six, six, six, six] });
    ok(r.status === 413 && r.j.code === "too_large" && /5 张/.test(r.j.message), "6 × 4.8MB (≈38MB body) → 413 from Content-Length, before parsing", r.j.message);
    const five = `data:image/jpeg;base64,${Buffer.alloc(4_800_000).toString("base64")}`; // 5 × 4.8MB ≈ 32MB body
    // one in flight per account; the first (accepted) check also carries the maximum input: 10000 chars + 5 images + 3 countries
    const [x, y] = await Promise.all([check(a, { dry_run_ms: 1500, info: "长".repeat(10000), images: Array(5).fill(five) }), (async () => { await sleep(300); return check(a); })()]);
    ok(x.status === 200 && y.status === 409 && y.j.code === "in_flight", "max input (10000 chars + 5 × 4.8MB images + 3 countries) accepted; second concurrent check on the same account → 409 in_flight", `${x.status}/${y.status}`);
    // per-account cap: one used above; one more ok (3-country check counts once), then 429
    r = await check(a);
    ok(r.status === 200 && r.j.quota?.used === 2 && r.j.countries?.length === 3, "3-country check counts as 1 (used 2/2)", JSON.stringify(r.j.quota));
    r = await check(a);
    ok(r.status === 429 && r.j.code === "user_quota", "per-account cap → 429 user_quota", r.j.message);
    r = await call("/api/auth/me", { token: a });
    ok(r.j.quota?.used === 2, "rejected check did not consume quota", JSON.stringify(r.j.quota));
    // site-wide cap: 2 used by A; B gets 1, then the site is out
    r = await check(b);
    ok(r.status === 200, "account B check #1 ok (site-wide 3/3)");
    r = await check(b);
    ok(r.status === 429 && r.j.code === "global_quota" && r.j.message === "今日检查名额已用完，请明天再来", "site-wide cap → 429 global_quota", r.j.message);
    r = await call("/api/auth/me", { token: b });
    ok(r.j.quota?.used === 1, "global rejection refunded B's account counter", JSON.stringify(r.j.quota));
  } finally { w.stop(); }
}

async function phaseB() {
  console.log("\n— phase B: per-IP 2/day —");
  const w = await startWorker(18792, { CHECKS_PER_USER_PER_DAY: "100", CHECKS_PER_IP_PER_DAY: "2", CHECKS_GLOBAL_PER_DAY: "100", RATE_LIMIT_DISABLED_LOCAL: "1" });
  try {
    const { register, check } = client(w.api);
    const a = await register("ip-a"), b = await register("ip-b");
    ok((await check(a)).status === 200 && (await check(b)).status === 200, "two checks from one IP ok");
    const r = await check(a);
    ok(r.status === 429 && r.j.code === "ip_quota", "third check from the same IP → 429 ip_quota", r.j.message);
  } finally { w.stop(); }
}

async function phaseC() {
  console.log("\n— phase C: site-wide email cap 2/day —");
  const w = await startWorker(18793, { MAIL_GLOBAL_PER_DAY: "2", MAIL_PER_IP_PER_DAY: "100" });
  try {
    const { call } = client(w.api);
    const send = (i: number) => call("/api/auth/send-code", { body: { email: `mail${i}+${Date.now()}@example.com`, purpose: "register" } });
    const s1 = await send(1), s2 = await send(2), s3 = await send(3);
    ok(s1.status === 200 && s2.status === 200, "first two codes sent");
    ok(s3.status === 429 && s3.j.code === "mail_global_quota", "third code site-wide → 429 mail_global_quota", s3.j.message);
  } finally { w.stop(); }
}

(async () => {
  try { await phaseA(); await phaseB(); await phaseC(); } catch (e) { console.error(e); fail++; }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
