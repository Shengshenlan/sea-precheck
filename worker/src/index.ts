import { sanitizeInput, buildReport, imageEvidenceText, mandatoryCerts } from "../../src/lib/core/match";
import type { CheckInput, ImageFacts } from "../../src/lib/core/types";
import { runFetch, runPi, UpstreamError, resolveThinking, type LlmConfig } from "./agent";
import { extractJson, postProcess } from "./parse";
import { checkImages, runVision, factsForPrompt } from "./vision";
import { hashPassword, verifyPassword, DUMMY_HASH, signJwt, verifyJwt, makeChallenge, checkChallenge, hmacHex, EMAIL_RE, passwordProblem } from "./auth";

interface RateLimit { limit(o: { key: string }): Promise<{ success: boolean }> }
interface D1Stmt { bind(...v: unknown[]): D1Stmt; first<T = any>(): Promise<T | null>; all<T = any>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes?: number; last_row_id?: number } }> }
interface D1 { prepare(q: string): D1Stmt; batch(s: D1Stmt[]): Promise<unknown> }
export interface Env {
  ZHIPUAI_API_KEY?: string; LLM_THINKING?: string; LLM_BASE_URL: string; LLM_MODEL: string; ALLOWED_ORIGINS: string;
  VISION_BASE_URL?: string; VISION_MODEL?: string;
  RATE_LIMIT_PER_HOUR?: string; AGENT_IMPL?: string; REQUEST_TIMEOUT_MS?: string; PI_DEBUG?: string; RATE_LIMIT_DISABLED_LOCAL?: string;
  JWT_SECRET?: string; DAILY_AI_QUOTA?: string; REG_PER_IP_PER_DAY?: string; PBKDF2_ITERATIONS?: string;
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
  // the user must still exist (account deletion invalidates tokens)
  const row = env.DB ? await env.DB.prepare("SELECT id, email FROM users WHERE id = ?").bind(p.sub).first<{ id: number; email: string }>() : null;
  return row;
}

async function usageToday(env: Env, uid: number): Promise<number> {
  const r = await env.DB!.prepare("SELECT n FROM usage WHERE user_id = ? AND day = ?").bind(uid, today()).first<{ n: number }>();
  return r?.n || 0;
}

// ---------------- auth routes ----------------
async function authRoutes(req: Request, env: Env, url: URL, ch: H, ip: string, localBypass: boolean): Promise<Response> {
  if (!env.DB || !env.JWT_SECRET) return json({ ok: false, code: "auth_disabled", message: "登录功能未配置（缺少 D1 或 JWT_SECRET）" }, 503, ch);
  const p = url.pathname;
  if (p === "/api/auth/challenge" && req.method === "GET") return json({ ok: true, ...(await makeChallenge(env.JWT_SECRET)) }, 200, ch);
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
  if (req.method !== "POST" || (p !== "/api/auth/register" && p !== "/api/auth/login")) return json({ ok: false, message: "not found" }, 404, ch);

  if (!localBypass && env.RL_AUTH && !(await env.RL_AUTH.limit({ key: `auth:${ip}` })).success)
    return json({ ok: false, code: "rate_limited", message: "尝试次数过多，请一分钟后再试" }, 429, ch);
  const body = await readJson(req, 2048);
  if (body === null) return json({ ok: false, message: "请求过大" }, 413, ch);
  if (!body || typeof body !== "object") return json({ ok: false, message: "请求格式错误" }, 400, ch);
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ ok: false, code: "bad_email", message: "请输入有效的邮箱地址" }, 400, ch);

  if (p === "/api/auth/register") {
    if (body.website) return json({ ok: false, code: "bot", message: "注册失败" }, 400, ch); // honeypot
    if (!(await checkChallenge(env.JWT_SECRET, body.challenge_token, body.challenge_answer))) return json({ ok: false, code: "bad_challenge", message: "验证题答案不正确或已过期，请刷新后重试" }, 400, ch);
    const pp = passwordProblem(body.password, email);
    if (pp) return json({ ok: false, code: "weak_password", message: pp }, 400, ch);
    const ipHash = (await hmacHex(env.JWT_SECRET, `ip|${ip}`)).slice(0, 32);
    const perDay = Math.max(1, parseInt(env.REG_PER_IP_PER_DAY || "5", 10));
    const r = await env.DB.prepare("SELECT n FROM reg_ip WHERE ip_hash = ? AND day = ?").bind(ipHash, today()).first<{ n: number }>();
    if (!localBypass && (r?.n || 0) >= perDay) return json({ ok: false, code: "rate_limited", message: "该网络今日注册次数已达上限" }, 429, ch);
    if (await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()) return json({ ok: false, code: "exists", message: "该邮箱已注册，请直接登录" }, 409, ch);
    const pw = await hashPassword(body.password, Math.min(100_000, Math.max(10_000, parseInt(env.PBKDF2_ITERATIONS || "100000", 10))));
    const ins = await env.DB.prepare("INSERT INTO users (email, pw, created_at) VALUES (?, ?, ?)").bind(email, pw, Date.now()).run();
    await env.DB.prepare("INSERT INTO reg_ip (ip_hash, day, n) VALUES (?, ?, 1) ON CONFLICT(ip_hash, day) DO UPDATE SET n = n + 1").bind(ipHash, today()).run();
    const id = Number(ins.meta.last_row_id);
    console.log(JSON.stringify({ evt: "register" }));
    return json({ ok: true, token: await signJwt({ sub: id, email }, env.JWT_SECRET), user: { id, email } }, 200, ch);
  }
  // login: same message for unknown email / wrong password; dummy hash keeps timing similar
  const row = await env.DB.prepare("SELECT id, email, pw FROM users WHERE email = ?").bind(email).first<{ id: number; email: string; pw: string }>();
  const good = await verifyPassword(String(body.password || ""), row?.pw || DUMMY_HASH);
  if (!row || !good) return json({ ok: false, code: "bad_credentials", message: "邮箱或密码错误" }, 401, ch);
  return json({ ok: true, token: await signJwt({ sub: row.id, email: row.email }, env.JWT_SECRET), user: { id: row.id, email: row.email } }, 200, ch);
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
  if (!env.DB || !env.JWT_SECRET) return json({ ok: false, code: "auth_disabled", message: "登录功能未配置，AI 分析不可用。以下为纯规则结果。" }, 503, ch);
  const user = await currentUser(req, env);
  if (!user) return json({ ok: false, code: "login_required", message: "AI 分析和图片识别需要登录（免费）。以下为纯规则结果。" }, 401, ch);

  const perHour = Math.max(1, parseInt(env.RATE_LIMIT_PER_HOUR || "10", 10));
  if (!localBypass && env.RL_GLOBAL && !(await env.RL_GLOBAL.limit({ key: "global" })).success)
    return json({ ok: false, code: "rate_limited", message: "当前使用人数较多，AI 分析暂时排队中，请一分钟后再试。以下为纯规则结果。" }, 429, ch);
  if (!localBypass && ((env.RL_IP && !(await env.RL_IP.limit({ key: `ip:${ip}` })).success) || !hourlyOk(ip, perHour)))
    return json({ ok: false, code: "rate_limited", message: `AI 分析次数已达上限（每个 IP 每小时约 ${perHour} 次），请稍后再试。以下为纯规则结果。` }, 429, ch);

  const body = await readJson(req, MAX_BODY_IMAGES);
  if (body === null) return json({ ok: false, message: "输入过大（图片总计需小于 1.5MB）" }, 413, ch);
  if (!body || typeof body !== "object") return json({ ok: false, message: "请求格式错误" }, 400, ch);
  const images: string[] = Array.isArray(body.images) ? body.images : [];
  const imgErr = checkImages(body.images);
  if (imgErr) return json({ ok: false, code: "bad_image", message: imgErr }, 400, ch);
  const { images: _drop, ...textPart } = body;
  if (JSON.stringify(textPart).length > MAX_BODY_TEXT) return json({ ok: false, message: "输入过长" }, 413, ch);
  const input = sanitizeInput(textPart as CheckInput);
  if (input.title.length < 2 && !images.length) return json({ ok: false, message: "请填写商品标题或上传图片" }, 400, ch);
  if (input.title.length < 2) input.title = "（见图片）";
  if (!env.ZHIPUAI_API_KEY) return json({ ok: false, code: "disabled", message: "AI 后端未配置密钥，以下为纯规则结果。" }, 503, ch);

  const limit = quotaOf(env);
  const used = await usageToday(env, user.id);
  if (!localBypass && used >= limit) return json({ ok: false, code: "user_quota", message: `今日 AI 分析次数已用完（每天 ${limit} 次），明天再来。以下为纯规则结果。` }, 429, ch);
  await env.DB.prepare("INSERT INTO usage (user_id, day, n) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET n = n + 1").bind(user.id, today()).run();

  const timeoutMs = parseInt(env.REQUEST_TIMEOUT_MS || "45000", 10) + (images.length ? 15000 : 0);
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const deadline = new Promise<never>((_, rej) => ctl.signal.addEventListener("abort", () => rej(new UpstreamError("timeout", "deadline"))));
  const t0 = Date.now();
  (globalThis as any).__PI_DEBUG = env.PI_DEBUG === "1";
  try {
    // 1) vision: extract structured facts from images (evidence only; failures degrade to text-only)
    let facts: ImageFacts | null = null; let image_error: string | null = null; let vision_ms = 0;
    if (images.length) {
      const tv = Date.now();
      try {
        facts = await Promise.race([runVision(images, { baseUrl: env.VISION_BASE_URL || env.LLM_BASE_URL, model: env.VISION_MODEL || "glm-4.6v", apiKey: env.ZHIPUAI_API_KEY, signal: ctl.signal }, extractJson), deadline]);
      } catch (e) {
        image_error = e instanceof UpstreamError ? e.code : "error";
        console.log(JSON.stringify({ evt: "vision_error", code: image_error, detail: e instanceof UpstreamError ? e.detail : "", ms: Date.now() - tv }));
        if (ctl.signal.aborted) throw e;
      }
      vision_ms = Date.now() - tv;
    }
    const imageText = imageEvidenceText(facts);

    // 2) text agent over KB tools, with image facts as extra evidence
    const cfg: LlmConfig = { baseUrl: env.LLM_BASE_URL, model: env.LLM_MODEL, apiKey: env.ZHIPUAI_API_KEY, timeoutMs: Math.max(5000, timeoutMs - 3000), signal: ctl.signal,
      thinking: resolveThinking(env.LLM_THINKING), imageText, imagePrompt: facts ? factsForPrompt(facts) : undefined };
    const impl = env.AGENT_IMPL === "fetch" ? runFetch : runPi;
    const attempt = async () => {
      try { return await impl(input, cfg); }
      catch (e) {
        if (e instanceof UpstreamError && e.code === "busy" && !ctl.signal.aborted) { await new Promise((r) => setTimeout(r, 3000)); return await impl(input, cfg); }
        throw e;
      }
    };
    const run = await Promise.race([attempt(), deadline]);
    const parsed = extractJson(run.text);
    if (!parsed) return json({ ok: false, code: "bad_output", message: "AI 输出无法解析，以下为纯规则结果。", image_facts: facts }, 502, ch);
    const out = postProcess(input, parsed, imageText);
    const result = { ok: true, model: env.LLM_MODEL, vision_model: facts ? facts.model : null, impl: run.impl, tool_calls: run.toolCalls, latency_ms: Date.now() - t0, vision_ms, image_facts: facts, image_error, ...out };

    // 3) history: input summary (never images) + result JSON
    let check_id: number | null = null;
    try {
      const rep = buildReport(input, { category: out.category ?? undefined, features: out.features, items: out.items, extraRuleIds: out.extra_rule_ids, imageText });
      const summary = { title: input.title.slice(0, 200), description: (input.description || "").slice(0, 300), country: input.country, platform: input.platform, category: input.category || "auto", image_count: images.length, risk: rep.risk.level, cat_pred: rep.category, cert_count: mandatoryCerts(rep).length };
      const ins = await env.DB.prepare("INSERT INTO checks (user_id, created_at, summary, result) VALUES (?, ?, ?, ?)").bind(user.id, Date.now(), JSON.stringify(summary), JSON.stringify(result)).run();
      check_id = Number(ins.meta.last_row_id);
      await env.DB.prepare("DELETE FROM checks WHERE user_id = ? AND id NOT IN (SELECT id FROM checks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)").bind(user.id, user.id, MAX_HISTORY).run();
    } catch { console.log(JSON.stringify({ evt: "history_error" })); }
    return json({ ...result, check_id, quota: { used: used + 1, limit } }, 200, ch);
  } catch (e) {
    const code = e instanceof UpstreamError ? e.code : ctl.signal.aborted ? "timeout" : "error";
    console.log(JSON.stringify({ evt: "llm_error", code, detail: e instanceof UpstreamError ? e.detail : String((e as any)?.name || ""), ms: Date.now() - t0 })); // never log input or key
    const msg: Record<string, string> = {
      quota: "AI 免费额度已用完，以下为纯规则结果。", busy: "AI 服务繁忙，以下为纯规则结果。", timeout: "AI 分析超时，以下为纯规则结果。",
      auth: "AI 后端配置有误，以下为纯规则结果。", model: "AI 后端模型配置有误，以下为纯规则结果。", error: "AI 分析失败，以下为纯规则结果。",
    };
    return json({ ok: false, code, message: msg[code] || msg.error }, code === "quota" ? 503 : code === "timeout" ? 504 : 502, ch);
  } finally { clearTimeout(timer); }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url); const origin = req.headers.get("origin"); const ch = cors(origin, env);
    if (req.method === "OPTIONS") return new Response(null, { status: ch["Access-Control-Allow-Origin"] ? 204 : 403, headers: ch });
    if (url.pathname === "/api/health") return json({ ok: true, model: env.LLM_MODEL, vision_model: env.VISION_MODEL || "glm-4.6v", impl: env.AGENT_IMPL || "pi", thinking: resolveThinking(env.LLM_THINKING), key_configured: !!env.ZHIPUAI_API_KEY, auth: !!(env.DB && env.JWT_SECRET), daily_quota: quotaOf(env) }, 200, ch);
    // Browser requests from non-allowed origins are refused. Requests without Origin (curl, eval) are allowed but still rate limited.
    if (origin && !ch["Access-Control-Allow-Origin"]) return json({ ok: false, message: "origin not allowed" }, 403, ch);
    const ip = req.headers.get("cf-connecting-ip") || "local";
    // Local eval only: honoured solely for loopback hosts, so it is inert on workers.dev / custom domains.
    const localBypass = env.RATE_LIMIT_DISABLED_LOCAL === "1" && ["localhost", "127.0.0.1"].includes(url.hostname);
    try {
      if (url.pathname.startsWith("/api/auth/")) return await authRoutes(req, env, url, ch, ip, localBypass);
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
