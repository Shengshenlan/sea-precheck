import type { CheckInput, Category, Feature, ImageFacts, LlmNote } from "./core/types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "radar_token";

/** Bearer token lives in localStorage (see DEPLOY.md: simpler cross-origin than cookies, but readable by any XSS on this origin). */
export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

export interface LlmResponse {
  ok: true; model: string; category: Category | null; features: Feature[]; items: string[];
  extra_rule_ids: string[]; notes: LlmNote[]; next_steps: string[]; summary: string; latency_ms: number; dropped: number;
  image_facts?: ImageFacts | null; image_error?: string | null; vision_ms?: number; check_id?: number | null;
  quota?: { used: number; limit: number }; evidence?: { feature: string; source: "text" | "image"; term: string }[];
}
export type LlmFail = { ok: false; reason: "disabled" | "login_required" | "rate_limited" | "quota" | "timeout" | "error"; message: string };
export type LlmResult = LlmResponse | LlmFail;

async function call<T = any>(path: string, init: RequestInit = {}, auth = true): Promise<{ status: number; body: T & { ok?: boolean; code?: string; message?: string } }> {
  const headers: Record<string, string> = { ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers as Record<string, string> || {}) };
  const t = auth ? tokenStore.get() : null;
  if (t) headers.authorization = `Bearer ${t}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && t && body.code === "unauthorized") tokenStore.clear();
  return { status: res.status, body };
}

export async function fetchLlm(input: CheckInput, images: string[], signal?: AbortSignal): Promise<LlmResult> {
  if (!API_URL) return { ok: false, reason: "disabled", message: "本站未配置 AI 后端，当前为纯规则结果（全部在浏览器内计算）。" };
  if (!tokenStore.get()) return { ok: false, reason: "login_required", message: "登录后即可使用 AI 补充分析与图片识别。" };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), images.length ? 85000 : 65000);
  signal?.addEventListener("abort", () => ctl.abort());
  try {
    const { status, body } = await call<LlmResponse>("/api/check", { method: "POST", body: JSON.stringify({ ...input, images }), signal: ctl.signal });
    if (status === 401) return { ok: false, reason: "login_required", message: "登录已失效，请重新登录后使用 AI 分析。" };
    if (status === 429) return { ok: false, reason: body.code === "user_quota" ? "quota" : "rate_limited", message: body.message || "AI 分析次数已达上限，稍后再试。" };
    if (status === 503 && body.code === "quota") return { ok: false, reason: "quota", message: body.message || "AI 服务暂时不可用（额度已达上限），以下为规则引擎结果。" };
    if (status !== 200 || !body.ok) return { ok: false, reason: "error", message: body.message || `AI 后端暂不可用（HTTP ${status}），以下为纯规则结果。` };
    return body as LlmResponse;
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return { ok: false, reason: aborted ? "timeout" : "error", message: aborted ? "AI 分析超时，以下为纯规则结果。" : "无法连接 AI 后端（网络问题），以下为纯规则结果。" };
  } finally { clearTimeout(t); }
}

export interface User { id: number; email: string }
export interface Quota { used: number; limit: number }
export const api = {
  me: () => call<{ user: User; quota: Quota }>("/api/auth/me"),
  challenge: () => call<{ token: string; question: string }>("/api/auth/challenge", {}, false),
  login: (email: string, password: string) => call<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  register: (b: { email: string; password: string; challenge_token: string; challenge_answer: string; website: string }) =>
    call<{ token: string; user: User }>("/api/auth/register", { method: "POST", body: JSON.stringify(b) }, false),
  deleteAccount: () => call("/api/auth/account", { method: "DELETE" }),
  history: () => call<{ items: HistoryItem[] }>("/api/history"),
  historyItem: (id: number) => call<{ item: HistoryItem & { result: LlmResponse } }>(`/api/history/${id}`),
  deleteHistory: (id?: number) => call(id ? `/api/history/${id}` : "/api/history", { method: "DELETE" }),
};
export interface HistoryItem {
  id: number; created_at: number; title: string; description: string; country: CheckInput["country"]; platform: CheckInput["platform"];
  category: CheckInput["category"]; image_count: number; risk: string | null; cat_pred: Category | null;
  /** mandatory certificates/licences (absent on records saved before 2026-10-23) */ cert_count?: number;
}
