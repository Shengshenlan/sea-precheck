import { sanitizeInput, buildReport, imageEvidenceText } from "../../src/lib/core/match";
import { splitInfo, summarize } from "../../src/lib/core/verdict";
import type { CheckInput, Country, ImageFacts } from "../../src/lib/core/types";
import { runFetch, runPi, UpstreamError, resolveThinking, type LlmConfig } from "./agent";
import { extractJson, postProcess } from "./parse";
import { checkImages, runVision, factsForPrompt } from "./vision";
import { hashPassword, verifyPassword, DUMMY_HASH, signJwt, verifyJwt, hmacHex, EMAIL_RE, passwordProblem, sixDigitCode, codeHash, hexEqual } from "./auth";
import { mailMode, sendCodeMail, type Purpose } from "./mail";

interface RateLimit { limit(o: { key: string }): Promise<{ success: boolean }> }
interface D1Stmt { bind(...v: unknown[]): D1Stmt; first<T = any>(): Promise<T | null>; all<T = any>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes?: number; last_row_id?: number } }> }
interface D1 { prepare(q: string): D1Stmt; batch(s: D1Stmt[]): Promise<unknown> }
export interface Env {
  ZHIPUAI_API_KEY?: string; LLM_THINKING?: string; LLM_BASE_URL: string; LLM_MODEL: string; ALLOWED_ORIGINS: string;
  VISION_BASE_URL?: string; VISION_MODEL?: string;
  RATE_LIMIT_PER_HOUR?: string; AGENT_IMPL?: string; REQUEST_TIMEOUT_MS?: string; PI_DEBUG?: string; RATE_LIMIT_DISABLED_LOCAL?: string;
  JWT_SECRET?: string; DAILY_AI_QUOTA?: string; REG_PER_IP_PER_DAY?: string; PBKDF2_ITERATIONS?: string;
  BREVO_API_KEY?: string; MAIL_FROM?: string; MAIL_FROM_NAME?: string; DEV_MAIL_LOG?: string; MAIL_PER_EMAIL_PER_DAY?: string; MAIL_PER_IP_PER_DAY?: string;
  RL_IP?: RateLimit; RL_GLOBAL?: RateLimit; RL_AUTH?: RateLimit; DB?: D1;
}

const MAX_BODY_TEXT = 8 * 1024;
const MAX_BODY_IMAGES = 2_100_000;
const MAX_HISTORY = 200; // per user; oldest are pruned
// Best-effort hourly window per isolate (no KV / Durable Objects on purpose). The RL_IP binding is the edge-wide per-minute limit.
const hourly = new Map<string, number[]>();
function hourlyOk(ip: string, limit: number): boolean {
  const now = Date.now(); const arr = (hourly.get(ip) || []).filter((t) => now - t < 3600_000);
  if (arr.length >= limit) { hourly.set(ip, arr); return false; }
  arr.push(now); hourly.set(ip, arr);
  if (hourly.size > 5000) for (const [k, v] of hourly) if (!v.length || now - v[v.length - 1] > 3600_000) hourly.delete(k);
  return true;
}

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const h: Record<string, string> = { "Vary": "Origin" };
  if (origin && allowed.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin; h["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "content-type, authorization"; h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}
type H = Record<string, string>;
const json = (body: unknown, status: number, headers: H) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const today = () => new Date().toISOString().slice(0, 10);
const quotaOf = (env: Env) => Math.max(1, parseInt(env.DAILY_AI_QUOTA || "20", 10));

async function readJson(req: Request, max: number): Promise<any | Response> {
  const len = parseInt(req.headers.get("content-length") || "0", 10);
  if (len > max) return null;
  const t = await req.text();
  if (t.length > max) return null;
  try { return JSON.parse(t); } catch { return undefined; }
}

async function currentUser(req: Request, env: Env): Promise<{ id: number; email: string } | null> {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m || !env.JWT_SECRET) return null;
  const p = await verifyJwt(m[1], env.JWT_SECRET);
  if (!p) return null;
  // the user must still exist (account deletion invalidates tokens) and the token must predate no password reset
  const row = env.DB ? await env.DB.prepare("SELECT id, email, token_ver FROM users WHERE id = ?").bind(p.sub).first<{ id: number; email: string; token_ver: number }>() : null;
  if (!row || (p.v || 0) !== (row.token_ver || 0)) return null;
  return { id: row.id, email: row.email };
}

async function usageToday(env: Env, uid: number): Promise<number> {
  const r = await env.DB!.prepare("SELECT n FROM usage WHERE user_id = ? AND day = ?").bind(uid, today()).first<{ n: number }>();
  return r?.n || 0;
}

// ---------------- auth routes ----------------
const CODE_TTL_MS = 10 * 60_000, CODE_COOLDOWN_S = 60, CODE_MAX_ATTEMPTS = 5;
async function authRoutes(req: Request, env: Env, url: URL, ch: H, ip: string, localBypass: boolean, localHost: boolean): Promise<Response> {
  if (!env.DB || !env.JWT_SECRET) return json({ ok: false, code: "auth_disabled", message: "登录功能未配置（缺少 D1 或 JWT_SECRET）" }, 503, ch);
  const p = url.pathname;
  if (p === "/api/auth/me" && req.method === "GET") {
    const u = await currentUser(req, env);
    if (!u) return json({ ok: false, code: "unauthorized", message: "请先登录" }, 401, ch);
    return json({ ok: true, user: { id: u.id, email: u.email }, quota: { used: await usageToday(env, u.id), limit: quotaOf(env) } }, 200, ch);
  }
  if (p === "/api/auth/account" && req.method === "DELETE") {
    const u = await currentUser(req, env);
    if (!u) return json({ ok: false, code: "unauthorized", message: "请先登录" }, 401, ch);
    await env.DB.batch([env.DB.prepare("DELETE FROM checks WHERE user_id = ?").bind(u.id), env.DB.prepare("DELETE FROM usage WHERE user_id = ?").bind(u.id), env.DB.prepare("DELETE FROM users WHERE id = ?").bind(u.id)]);
    return json({ ok: true }, 200, ch);
  }
  if (req.method !== "POST" || !["/api/auth/send-code", "/api/auth/register", "/api/auth/reset", "/api/auth/login"].includes(p)) return json({ ok: false, message: "not found" }, 404, ch);

  if (!localBypass && env.RL_AUTH && !(await env.RL_AUTH.limit({ key: `auth:${ip}` })).success)
    return json({ ok: false, code: "rate_limited", message: "操作过于频繁，请一分钟后再试" }, 429, ch);
  const body = await readJson(req, 2048);
  if (body === null) return json({ ok: false, message: "请求过大" }, 413, ch);
  if (!body || typeof body !== "object") return json({ ok: false, message: "请求格式错误" }, 400, ch);
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ ok: false, code: "bad_email", message: "请输入有效的邮箱地址" }, 400, ch);
  const secret = env.JWT_SECRET;
  const DB = env.DB;
  const tokenFor = async (id: number, em: string, v: number) => signJwt({ sub: id, email: em, v }, secret);
  const iterations = Math.min(100_000, Math.max(10_000, parseInt(env.PBKDF2_ITERATIONS || "100000", 10)));

  if (p === "/api/auth/send-code") {
    const purpose: Purpose | null = body.purpose === "register" || body.purpose === "reset" ? body.purpose : null;
    if (!purpose) return json({ ok: false, message: "请求格式错误" }, 400, ch);
    if (body.website) return json({ ok: true, cooldown: CODE_COOLDOWN_S }, 200, ch); // honeypot: pretend success, send nothing
    const mode = mailMode(env);
    if (mode === "off") { console.log(JSON.stringify({ evt: "mail_not_configured" })); return json({ ok: false, code: "mail_disabled", message: "邮件服务暂未配置，暂时无法发送验证码，请稍后再试" }, 503, ch); }
    const exists = !!(await DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first());
    if (purpose === "register" && exists) return json({ ok: false, code: "exists", message: "该邮箱已注册，请直接登录" }, 409, ch);
    const now = Date.now();
    const prev = await DB.prepare("SELECT last_sent_at FROM email_codes WHERE email = ? AND purpose = ?").bind(email, purpose).first<{ last_sent_at: number }>();
    if (prev && now - prev.last_sent_at < CODE_COOLDOWN_S * 1000) {
      const wait = Math.ceil((CODE_COOLDOWN_S * 1000 - (now - prev.last_sent_at)) / 1000);
      return json({ ok: false, code: "cooldown", retry_after: wait, message: `请 ${wait} 秒后再重新发送` }, 429, ch);
    }
    const ipKey = `i:${(await hmacHex(secret, `ip|${ip}`)).slice(0, 32)}`, emKey = `e:${(await hmacHex(secret, `email|${email}`)).slice(0, 32)}`;
    const ipMax = Math.max(1, parseInt(env.MAIL_PER_IP_PER_DAY || "20", 10)), emMax = Math.max(1, parseInt(env.MAIL_PER_EMAIL_PER_DAY || "8", 10));
    const cnt = async (k: string) => (await DB.prepare("SELECT n FROM mail_counters WHERE k = ? AND day = ?").bind(k, today()).first<{ n: number }>())?.n || 0;
    if (!localBypass && (await cnt(ipKey)) >= ipMax) return json({ ok: false, code: "rate_limited", message: "当前网络今日发送验证码次数已达上限，请明天再试" }, 429, ch);
    if (!localBypass && (await cnt(emKey)) >= emMax) return json({ ok: false, code: "rate_limited", message: "该邮箱今日接收验证码次数已达上限，请明天再试" }, 429, ch);
    const bump = (k: string) => DB.prepare("INSERT INTO mail_counters (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k, day) DO UPDATE SET n = n + 1").bind(k, today());
    // reset for an unknown email: same response, nothing sent (does not reveal whether the address is registered)
    if (purpose === "reset" && !exists) {
      await DB.batch([bump(ipKey), DB.prepare("INSERT INTO email_codes (email, purpose, code_hash, expires_at, attempts, last_sent_at) VALUES (?, 'reset', 'x', ?, 0, ?) ON CONFLICT(email, purpose) DO UPDATE SET code_hash = 'x', expires_at = excluded.expires_at, attempts = 0, last_sent_at = excluded.last_sent_at").bind(email, now + CODE_TTL_MS, now)]);
      return json({ ok: true, cooldown: CODE_COOLDOWN_S, ...(mode === "dev" ? { dev: true } : {}) }, 200, ch);
    }
    const code = sixDigitCode();
    await DB.batch([
      bump(ipKey), bump(emKey),
      DB.prepare("INSERT INTO email_codes (email, purpose, code_hash, expires_at, attempts, last_sent_at) VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(email, purpose) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, last_sent_at = excluded.last_sent_at")
        .bind(email, purpose, await codeHash(secret, purpose, email, code), now + CODE_TTL_MS, now),
      DB.prepare("DELETE FROM email_codes WHERE expires_at < ?").bind(now - 86400_000),
      DB.prepare("DELETE FROM mail_counters WHERE day < ?").bind(new Date(now - 2 * 86400_000).toISOString().slice(0, 10)),
    ]);
    const sent = await sendCodeMail(env, email, purpose, code);
    if (!sent.ok) {
      console.log(JSON.stringify({ evt: "mail_error", detail: sent.detail }));
      await DB.prepare("DELETE FROM email_codes WHERE email = ? AND purpose = ?").bind(email, purpose).run();
      return json({ ok: false, code: "mail_failed", message: "验证码邮件发送失败，请稍后重试" }, 502, ch);
    }
    console.log(JSON.stringify({ evt: "code_sent", purpose }));
    // dev_code only when mail is in local log mode AND the request hit a loopback host — never in production
    const devCode = mode === "dev" && localHost ? { dev: true, dev_code: code } : mode === "dev" ? { dev: true } : {};
    return json({ ok: true, cooldown: CODE_COOLDOWN_S, ...devCode }, 200, ch);
  }

  /** Spends one attempt atomically, then compares. Returns an error message or null on success (code consumed). */
  const consume = async (purpose: Purpose): Promise<string | null> => {
    const code = String(body.code || "").trim();
    if (!/^\d{6}$/.test(code)) return "请输入 6 位数字验证码";
    const row = await DB.prepare("SELECT code_hash, expires_at, attempts FROM email_codes WHERE email = ? AND purpose = ?").bind(email, purpose).first<{ code_hash: string; expires_at: number; attempts: number }>();
    if (!row || row.expires_at < Date.now()) return "验证码已过期或未发送，请重新获取";
    if (row.attempts >= CODE_MAX_ATTEMPTS) return "验证码错误次数过多，请重新获取";
    const spent = await DB.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE email = ? AND purpose = ? AND attempts < ?").bind(email, purpose, CODE_MAX_ATTEMPTS).run();
    if (!spent.meta.changes) return "验证码错误次数过多，请重新获取";
    if (!hexEqual(await codeHash(secret, purpose, email, code), row.code_hash)) {
      const left = CODE_MAX_ATTEMPTS - row.attempts - 1;
      return left > 0 ? `验证码不正确，还可尝试 ${left} 次` : "验证码错误次数过多，请重新获取";
    }
    await DB.prepare("DELETE FROM email_codes WHERE email = ? AND purpose = ?").bind(email, purpose).run();
    return null;
  };

  if (p === "/api/auth/register") {
    if (body.website) return json({ ok: false, code: "bot", message: "注册失败" }, 400, ch); // honeypot
    const pp = passwordProblem(body.password, email);
    if (pp) return json({ ok: false, code: "weak_password", message: pp }, 400, ch);
    if (await DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()) return json({ ok: false, code: "exists", message: "该邮箱已注册，请直接登录" }, 409, ch);
    const ipHash = (await hmacHex(secret, `ip|${ip}`)).slice(0, 32);
    const perDay = Math.max(1, parseInt(env.REG_PER_IP_PER_DAY || "5", 10));
    const r = await DB.prepare("SELECT n FROM reg_ip WHERE ip_hash = ? AND day = ?").bind(ipHash, today()).first<{ n: number }>();
    if (!localBypass && (r?.n || 0) >= perDay) return json({ ok: false, code: "rate_limited", message: "当前网络今日注册次数已达上限" }, 429, ch);
    const bad = await consume("register");
    if (bad) return json({ ok: false, code: "bad_code", message: bad }, 400, ch);
    const ins = await DB.prepare("INSERT INTO users (email, pw, created_at) VALUES (?, ?, ?)").bind(email, await hashPassword(body.password, iterations), Date.now()).run();
    await DB.prepare("INSERT INTO reg_ip (ip_hash, day, n) VALUES (?, ?, 1) ON CONFLICT(ip_hash, day) DO UPDATE SET n = n + 1").bind(ipHash, today()).run();
    const id = Number(ins.meta.last_row_id);
    console.log(JSON.stringify({ evt: "register" }));
    return json({ ok: true, token: await tokenFor(id, email, 0), user: { id, email } }, 200, ch);
  }
  if (p === "/api/auth/reset") {
    const pp = passwordProblem(body.password, email);
    if (pp) return json({ ok: false, code: "weak_password", message: pp }, 400, ch);
    const bad = await consume("reset");
    if (bad) return json({ ok: false, code: "bad_code", message: bad }, 400, ch);
    const row = await DB.prepare("SELECT id, email, token_ver FROM users WHERE email = ?").bind(email).first<{ id: number; email: string; token_ver: number }>();
    if (!row) return json({ ok: false, code: "bad_code", message: "验证码已过期或未发送，请重新获取" }, 400, ch);
    const v = (row.token_ver || 0) + 1;
    await DB.prepare("UPDATE users SET pw = ?, token_ver = ? WHERE id = ?").bind(await hashPassword(body.password, iterations), v, row.id).run();
    console.log(JSON.stringify({ evt: "password_reset" }));
    return json({ ok: true, token: await tokenFor(row.id, row.email, v), user: { id: row.id, email: row.email } }, 200, ch);
  }
  // login: same message for unknown email / wrong password; dummy hash keeps timing similar
  const row = await DB.prepare("SELECT id, email, pw, token_ver FROM users WHERE email = ?").bind(email).first<{ id: number; email: string; pw: string; token_ver: number }>();
  const good = await verifyPassword(String(body.password || ""), row?.pw || DUMMY_HASH);
  if (!row || !good) return json({ ok: false, code: "bad_credentials", message: "邮箱或密码错误" }, 401, ch);
  return json({ ok: true, token: await tokenFor(row.id, row.email, row.token_ver || 0), user: { id: row.id, email: row.email } }, 200, ch);
}

// ---------------- history routes ----------------
async function historyRoutes(req: Request, env: Env, url: URL, ch: H): Promise<Response> {
  if (!env.DB || !env.JWT_SECRET) return json({ ok: false, code: "auth_disabled", message: "登录功能未配置" }, 503, ch);
  const u = await currentUser(req, env);
  if (!u) return json({ ok: false, code: "unauthorized", message: "请先登录" }, 401, ch);
  const m = url.pathname.match(/^\/api\/history\/(\d+)$/);
  if (url.pathname === "/api/history" && req.method === "GET") {
    const { results } = await env.DB.prepare("SELECT id, created_at, summary FROM checks WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").bind(u.id).all<any>();
    return json({ ok: true, items: results.map((r) => ({ id: r.id, created_at: r.created_at, ...JSON.parse(r.summary) })) }, 200, ch);
  }
  if (url.pathname === "/api/history" && req.method === "DELETE") {
    const r = await env.DB.prepare("DELETE FROM checks WHERE user_id = ?").bind(u.id).run();
    return json({ ok: true, deleted: r.meta.changes || 0 }, 200, ch);
  }
  if (m && req.method === "GET") {
    const r = await env.DB.prepare("SELECT id, created_at, summary, result FROM checks WHERE id = ? AND user_id = ?").bind(+m[1], u.id).first<any>();
    if (!r) return json({ ok: false, message: "记录不存在" }, 404, ch);
    return json({ ok: true, item: { id: r.id, created_at: r.created_at, ...JSON.parse(r.summary), result: JSON.parse(r.result) } }, 200, ch);
  }
  if (m && req.method === "DELETE") {
    const r = await env.DB.prepare("DELETE FROM checks WHERE id = ? AND user_id = ?").bind(+m[1], u.id).run();
    return json({ ok: true, deleted: r.meta.changes || 0 }, 200, ch);
  }
  return json({ ok: false, message: "not found" }, 404, ch);
}

// ---------------- AI check ----------------
async function checkRoute(req: Request, env: Env, ch: H, ip: string, localBypass: boolean): Promise<Response> {
  if (!env.DB || !env.JWT_SECRET) return json({ ok: false, code: "auth_disabled", message: "登录功能未配置，AI 分析不可用" }, 503, ch);
  const user = await currentUser(req, env);
  if (!user) return json({ ok: false, code: "login_required", message: "请先登录后再检查" }, 401, ch);

  const perHour = Math.max(1, parseInt(env.RATE_LIMIT_PER_HOUR || "10", 10));
  if (!localBypass && env.RL_GLOBAL && !(await env.RL_GLOBAL.limit({ key: "global" })).success)
    return json({ ok: false, code: "rate_limited", message: "当前使用人数较多，AI 分析暂时排队中，请一分钟后再试" }, 429, ch);
  if (!localBypass && ((env.RL_IP && !(await env.RL_IP.limit({ key: `ip:${ip}` })).success) || !hourlyOk(ip, perHour)))
    return json({ ok: false, code: "rate_limited", message: `AI 分析次数已达上限（每个 IP 每小时约 ${perHour} 次），请稍后再试` }, 429, ch);

  const body = await readJson(req, MAX_BODY_IMAGES);
  if (body === null) return json({ ok: false, message: "输入过大（图片总计需小于 1.5MB）" }, 413, ch);
  if (!body || typeof body !== "object") return json({ ok: false, message: "请求格式错误" }, 400, ch);
  const images: string[] = Array.isArray(body.images) ? body.images : [];
  const imgErr = checkImages(body.images);
  if (imgErr) return json({ ok: false, code: "bad_image", message: imgErr }, 400, ch);
  const { images: _drop, ...textPart } = body;
  if (JSON.stringify(textPart).length > MAX_BODY_TEXT) return json({ ok: false, message: "输入过长" }, 413, ch);
  // new clients send `info` (one free-text box) + `countries`; the eval / old clients send title + description + country
  const legacy = !Array.isArray(body.countries);
  const countries: Country[] = legacy ? [] : [...new Set((body.countries as unknown[]).filter((c): c is Country => COUNTRIES.includes(c as Country)))];
  if (!legacy && !countries.length) return json({ ok: false, code: "bad_country", message: "请至少选择一个国家" }, 400, ch);
  const text = typeof body.info === "string" ? splitInfo(body.info) : { title: textPart.title, description: textPart.description };
  const input = sanitizeInput({ ...(textPart as CheckInput), ...text, country: legacy ? textPart.country : countries[0] });
  if (legacy) countries.push(input.country);
  if (input.title.length < 2 && !images.length) return json({ ok: false, message: "请填写商品信息或上传图片" }, 400, ch);
  if (input.title.length < 2) input.title = "（见图片）";
  if (!env.ZHIPUAI_API_KEY) return json({ ok: false, code: "disabled", message: "AI 服务未配置" }, 503, ch);

  const limit = quotaOf(env);
  const used = await usageToday(env, user.id);
  if (!localBypass && used >= limit) return json({ ok: false, code: "user_quota", message: `今日检查次数已用完（每天 ${limit} 次），请明天再来` }, 429, ch);
  await env.DB.prepare("INSERT INTO usage (user_id, day, n) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET n = n + 1").bind(user.id, today()).run();

  const timeoutMs = parseInt(env.REQUEST_TIMEOUT_MS || "45000", 10) + (images.length ? 15000 : 0);
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const deadline = new Promise<never>((_, rej) => ctl.signal.addEventListener("abort", () => rej(new UpstreamError("timeout", "deadline"))));
  deadline.catch(() => {});
  const t0 = Date.now();
  (globalThis as any).__PI_DEBUG = env.PI_DEBUG === "1";
  try {
    // 1) vision once for all countries: structured facts from images (evidence only; failures degrade to text-only)
    let facts: ImageFacts | null = null; let image_error: string | null = null; let vision_ms = 0;
    if (images.length) {
      const tv = Date.now();
      try {
        facts = await Promise.race([runVision(images, { baseUrl: env.VISION_BASE_URL || env.LLM_BASE_URL, model: env.VISION_MODEL || "glm-5.3-flash", apiKey: env.ZHIPUAI_API_KEY, signal: ctl.signal }, extractJson), deadline]);
      } catch (e) {
        image_error = e instanceof UpstreamError ? e.code : "error";
        console.log(JSON.stringify({ evt: "vision_error", code: image_error, detail: e instanceof UpstreamError ? e.detail : "", ms: Date.now() - tv }));
        if (ctl.signal.aborted) throw e;
      }
      vision_ms = Date.now() - tv;
    }
    const imageText = imageEvidenceText(facts);

    // 2) text agent per country, in parallel. KB tools, deterministic matching, quote validation and the guard are all per country.
    const cfg: LlmConfig = { baseUrl: env.LLM_BASE_URL, model: env.LLM_MODEL, apiKey: env.ZHIPUAI_API_KEY, timeoutMs: Math.max(5000, timeoutMs - 3000), signal: ctl.signal,
      thinking: resolveThinking(env.LLM_THINKING), imageText, imagePrompt: facts ? factsForPrompt(facts) : undefined };
    const impl = env.AGENT_IMPL === "fetch" ? runFetch : runPi;
    const one = async (country: Country, i: number) => {
      const ci: CheckInput = { ...input, country };
      if (i) await new Promise((r) => setTimeout(r, 400 * i)); // stagger to avoid upstream concurrency spikes
      const tc = Date.now();
      const attempt = async () => {
        try { return await impl(ci, cfg); }
        catch (e) {
          if (e instanceof UpstreamError && e.code === "busy" && !ctl.signal.aborted) { await new Promise((r) => setTimeout(r, 3000)); return await impl(ci, cfg); }
          throw e;
        }
      };
      const run = await Promise.race([attempt(), deadline]);
      const parsed = extractJson(run.text);
      if (!parsed) throw new UpstreamError("bad_output", "unparseable");
      return { ok: true as const, impl: run.impl, tool_calls: run.toolCalls, latency_ms: Date.now() - tc, ...postProcess(ci, parsed, imageText) };
    };
    const settled = await Promise.allSettled(countries.map(one));
    const results: Record<string, any> = {};
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") { results[countries[i]] = s.value; return; }
      const code = s.reason instanceof UpstreamError ? s.reason.code : ctl.signal.aborted ? "timeout" : "error";
      console.log(JSON.stringify({ evt: "llm_error", country: countries[i], code, detail: s.reason instanceof UpstreamError ? s.reason.detail : String(s.reason?.name || ""), ms: Date.now() - t0 })); // never log input or key
      results[countries[i]] = { ok: false, code, message: ERR_MSG[code] || ERR_MSG.error };
    });
    const okCount = Object.values(results).filter((r) => r.ok).length;
    if (!okCount) {
      const code = results[countries[0]].code;
      return json({ ok: false, code, message: ERR_MSG[code] || ERR_MSG.error, image_facts: facts }, code === "quota" ? 503 : code === "timeout" ? 504 : 502, ch);
    }
    const shared = { ok: true, model: env.LLM_MODEL, vision_model: facts ? facts.model : null, latency_ms: Date.now() - t0, vision_ms, image_facts: facts, image_error };
    const result = { ...shared, input: { title: input.title, description: input.description || "" }, countries, results };

    // 3) history: one row per check — input summary (never images) + per-country verdicts + result JSON
    let check_id: number | null = null;
    try {
      const verdicts: Record<string, string> = {}; let cat_pred: string | null = null;
      for (const c of countries) {
        const o = results[c];
        const rep = buildReport({ ...input, country: c }, o.ok ? { category: o.category ?? undefined, features: o.features, items: o.items, extraRuleIds: o.extra_rule_ids, imageText } : { imageText });
        verdicts[c] = summarize(rep).verdict; cat_pred ||= rep.category;
      }
      const summary = { title: input.title.slice(0, 200), description: (input.description || "").slice(0, 300), countries, category: input.category || "auto", image_count: images.length, verdicts, cat_pred };
      const ins = await env.DB.prepare("INSERT INTO checks (user_id, created_at, summary, result) VALUES (?, ?, ?, ?)").bind(user.id, Date.now(), JSON.stringify(summary), JSON.stringify(result)).run();
      check_id = Number(ins.meta.last_row_id);
      await env.DB.prepare("DELETE FROM checks WHERE user_id = ? AND id NOT IN (SELECT id FROM checks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)").bind(user.id, user.id, MAX_HISTORY).run();
    } catch { console.log(JSON.stringify({ evt: "history_error" })); }
    const quota = { used: used + 1, limit };
    // legacy single-country callers (eval) get the flat shape they always had
    if (legacy) { const r = results[countries[0]]; return json({ ...shared, impl: r.impl, tool_calls: r.tool_calls, ...r, latency_ms: shared.latency_ms, check_id, quota }, 200, ch); }
    return json({ ...result, check_id, quota }, 200, ch);
  } catch (e) {
    const code = e instanceof UpstreamError ? e.code : ctl.signal.aborted ? "timeout" : "error";
    console.log(JSON.stringify({ evt: "llm_error", code, detail: e instanceof UpstreamError ? e.detail : String((e as any)?.name || ""), ms: Date.now() - t0 })); // never log input or key
    return json({ ok: false, code, message: ERR_MSG[code] || ERR_MSG.error }, code === "quota" ? 503 : code === "timeout" ? 504 : 502, ch);
  } finally { clearTimeout(timer); }
}
const COUNTRIES: Country[] = ["TH", "PH", "MY"];
const ERR_MSG: Record<string, string> = {
  quota: "AI 服务额度已用完，请稍后再试", busy: "AI 服务繁忙，请稍后再试", timeout: "AI 分析超时，请稍后再试", bad_output: "AI 输出无法解析",
  auth: "AI 服务配置有误", model: "AI 服务模型配置有误", error: "AI 分析失败，请稍后再试",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url); const origin = req.headers.get("origin"); const ch = cors(origin, env);
    if (req.method === "OPTIONS") return new Response(null, { status: ch["Access-Control-Allow-Origin"] ? 204 : 403, headers: ch });
    if (url.pathname === "/api/health") return json({ ok: true, model: env.LLM_MODEL, vision_model: env.VISION_MODEL || "glm-5.3-flash", impl: env.AGENT_IMPL || "pi", thinking: resolveThinking(env.LLM_THINKING), key_configured: !!env.ZHIPUAI_API_KEY, auth: !!(env.DB && env.JWT_SECRET), daily_quota: quotaOf(env) }, 200, ch);
    // Browser requests from non-allowed origins are refused. Requests without Origin (curl, eval) are allowed but still rate limited.
    if (origin && !ch["Access-Control-Allow-Origin"]) return json({ ok: false, message: "origin not allowed" }, 403, ch);
    const ip = req.headers.get("cf-connecting-ip") || "local";
    // Local eval only: honoured solely for loopback hosts, so it is inert on workers.dev / custom domains.
    const isLoopback = ["localhost", "127.0.0.1"].includes(url.hostname);
    const localBypass = env.RATE_LIMIT_DISABLED_LOCAL === "1" && isLoopback;
    try {
      if (url.pathname.startsWith("/api/auth/")) return await authRoutes(req, env, url, ch, ip, localBypass, isLoopback);
      if (url.pathname === "/api/history" || url.pathname.startsWith("/api/history/")) return await historyRoutes(req, env, url, ch);
      if (url.pathname === "/api/check") {
        if (req.method !== "POST") return json({ ok: false, message: "method not allowed" }, 405, ch);
        return await checkRoute(req, env, ch, ip, localBypass);
      }
    } catch (e) {
      console.log(JSON.stringify({ evt: "unhandled", name: String((e as any)?.name || "") }));
      return json({ ok: false, code: "error", message: "服务器错误" }, 500, ch);
    }
    return json({ ok: false, message: "not found" }, 404, ch);
  },
};
