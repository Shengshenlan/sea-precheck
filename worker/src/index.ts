import { sanitizeInput } from "../../src/lib/core/match";
import type { CheckInput } from "../../src/lib/core/types";
import { runFetch, runPi, UpstreamError, resolveThinking, type LlmConfig } from "./agent";
import { extractJson, postProcess } from "./parse";

interface RateLimit { limit(o: { key: string }): Promise<{ success: boolean }> }
export interface Env {
  ZHIPUAI_API_KEY?: string; LLM_THINKING?: string; LLM_BASE_URL: string; LLM_MODEL: string; ALLOWED_ORIGINS: string;
  RATE_LIMIT_PER_HOUR?: string; AGENT_IMPL?: string; REQUEST_TIMEOUT_MS?: string; PI_DEBUG?: string; RATE_LIMIT_DISABLED_LOCAL?: string;
  RL_IP?: RateLimit; RL_GLOBAL?: RateLimit;
}

const MAX_BODY = 8 * 1024;
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
    h["Access-Control-Allow-Origin"] = origin; h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "content-type"; h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url); const origin = req.headers.get("origin"); const ch = cors(origin, env);
    if (req.method === "OPTIONS") return new Response(null, { status: ch["Access-Control-Allow-Origin"] ? 204 : 403, headers: ch });
    if (url.pathname === "/api/health") return json({ ok: true, model: env.LLM_MODEL, impl: env.AGENT_IMPL || "pi", thinking: resolveThinking(env.LLM_THINKING), key_configured: !!env.ZHIPUAI_API_KEY }, 200, ch);
    if (url.pathname !== "/api/check") return json({ ok: false, message: "not found" }, 404, ch);
    if (req.method !== "POST") return json({ ok: false, message: "method not allowed" }, 405, ch);
    // Browser requests from non-allowed origins are refused. Requests without Origin (curl, eval) are allowed but still rate limited.
    if (origin && !ch["Access-Control-Allow-Origin"]) return json({ ok: false, message: "origin not allowed" }, 403, ch);

    const ip = req.headers.get("cf-connecting-ip") || "local";
    // Local eval only: honoured solely for loopback hosts, so it is inert on workers.dev / custom domains.
    const localBypass = env.RATE_LIMIT_DISABLED_LOCAL === "1" && ["localhost", "127.0.0.1"].includes(url.hostname);
    const perHour = Math.max(1, parseInt(env.RATE_LIMIT_PER_HOUR || "10", 10));
    if (!localBypass && env.RL_GLOBAL && !(await env.RL_GLOBAL.limit({ key: "global" })).success)
      return json({ ok: false, code: "rate_limited", message: "当前使用人数较多，AI 分析暂时排队中，请一分钟后再试。以下为纯规则结果。" }, 429, ch);
    if (!localBypass && ((env.RL_IP && !(await env.RL_IP.limit({ key: `ip:${ip}` })).success) || !hourlyOk(ip, perHour)))
      return json({ ok: false, code: "rate_limited", message: `AI 分析次数已达上限（每个 IP 每小时约 ${perHour} 次），请稍后再试。以下为纯规则结果。` }, 429, ch);

    const len = parseInt(req.headers.get("content-length") || "0", 10);
    if (len > MAX_BODY) return json({ ok: false, message: "输入过长" }, 413, ch);
    const rawText = await req.text();
    if (rawText.length > MAX_BODY) return json({ ok: false, message: "输入过长" }, 413, ch);
    let body: CheckInput; try { body = JSON.parse(rawText); } catch { return json({ ok: false, message: "请求格式错误" }, 400, ch); }
    const input = sanitizeInput(body);
    if (input.title.length < 2) return json({ ok: false, message: "请填写商品标题" }, 400, ch);
    if (!env.ZHIPUAI_API_KEY) return json({ ok: false, code: "disabled", message: "AI 后端未配置密钥，以下为纯规则结果。" }, 503, ch);

    const timeoutMs = parseInt(env.REQUEST_TIMEOUT_MS || "45000", 10);
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const cfg: LlmConfig = { baseUrl: env.LLM_BASE_URL, model: env.LLM_MODEL, apiKey: env.ZHIPUAI_API_KEY, timeoutMs: Math.max(5000, timeoutMs - 3000), signal: ctl.signal, thinking: resolveThinking(env.LLM_THINKING) };
    const t0 = Date.now();
    (globalThis as any).__PI_DEBUG = env.PI_DEBUG === "1";
    try {
      let run;
      const impl = env.AGENT_IMPL === "fetch" ? runFetch : runPi;
      // hard deadline: don't rely on the upstream fetch honouring abort (observed 100 s+ hangs in workerd)
      const deadline = new Promise<never>((_, rej) => ctl.signal.addEventListener("abort", () => rej(new UpstreamError("timeout", "deadline"))));
      const attempt = async () => {
        try { return await impl(input, cfg); }
        catch (e) {
          if (e instanceof UpstreamError && e.code === "busy" && !ctl.signal.aborted) { await new Promise((r) => setTimeout(r, 3000)); return await impl(input, cfg); }
          throw e;
        }
      };
      run = await Promise.race([attempt(), deadline]);
      const parsed = extractJson(run.text);
      if (!parsed) return json({ ok: false, code: "bad_output", message: "AI 输出无法解析，以下为纯规则结果。" }, 502, ch);
      const out = postProcess(input, parsed);
      return json({ ok: true, model: env.LLM_MODEL, impl: run.impl, tool_calls: run.toolCalls, latency_ms: Date.now() - t0, ...out }, 200, ch);
    } catch (e) {
      const code = e instanceof UpstreamError ? e.code : ctl.signal.aborted ? "timeout" : "error";
      console.log(JSON.stringify({ evt: "llm_error", code, detail: e instanceof UpstreamError ? e.detail : String((e as any)?.name || ""), ms: Date.now() - t0 })); // never log input or key
      const msg: Record<string, string> = {
        quota: "AI 免费额度已用完，以下为纯规则结果。", busy: "AI 服务繁忙，以下为纯规则结果。", timeout: "AI 分析超时，以下为纯规则结果。",
        auth: "AI 后端配置有误，以下为纯规则结果。", model: "AI 后端模型配置有误，以下为纯规则结果。", error: "AI 分析失败，以下为纯规则结果。",
      };
      return json({ ok: false, code, message: msg[code] || msg.error }, code === "quota" ? 503 : code === "timeout" ? 504 : 502, ch);
    } finally { clearTimeout(timer); }
  },
};
