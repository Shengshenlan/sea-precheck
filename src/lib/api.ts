import type { Category, Country, Feature, ImageFacts, LlmNote, Platform } from "./core/types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "radar_token";

/** Bearer token lives in localStorage (see DEPLOY.md: simpler cross-origin than cookies, but readable by any XSS on this origin). */
export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

/** One country's AI analysis (already validated + guarded by the worker; re-validated client-side). */
export interface CountryResult {
  ok: true; category: Category | null; features: Feature[]; items: string[]; extra_rule_ids: string[]; notes: LlmNote[];
  next_steps: string[]; summary: string; latency_ms: number; dropped: number;
  evidence?: { feature: string; source: "text" | "image"; term: string }[];
}
export type CountryFail = { ok: false; code: string; message: string };
export interface CheckResponse {
  ok: true; model: string; latency_ms: number; vision_ms?: number; image_facts: ImageFacts | null; image_error: string | null;
  input: { title: string; description: string }; countries: Country[]; results: Partial<Record<Country, CountryResult | CountryFail>>;
  check_id?: number | null; quota?: Quota;
}

async function call<T = any>(path: string, init: RequestInit = {}, auth = true): Promise<{ status: number; body: T & { ok?: boolean; code?: string; message?: string } }> {
  const headers: Record<string, string> = { ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers as Record<string, string> || {}) };
  const t = auth ? tokenStore.get() : null;
  if (t) headers.authorization = `Bearer ${t}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && t && (body.code === "unauthorized" || body.code === "login_required")) tokenStore.clear();
  return { status: res.status, body };
}

export type CheckOutcome = CheckResponse | { ok: false; status: number; code: string; message: string };
export async function runCheck(info: string, countries: Country[], images: string[]): Promise<CheckOutcome> {
  if (!API_URL) return { ok: false, status: 0, code: "disabled", message: "服务暂未配置，请稍后再试" };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), images.length ? 90000 : 70000);
  try {
    const { status, body } = await call<CheckResponse>("/api/check", { method: "POST", body: JSON.stringify({ info, countries, images }), signal: ctl.signal });
    if (status === 200 && body.ok) return body as CheckResponse;
    return { ok: false, status, code: body.code || "error", message: body.message || `服务暂时不可用（HTTP ${status}），请稍后再试` };
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return { ok: false, status: 0, code: aborted ? "timeout" : "network", message: aborted ? "检查超时，请稍后再试" : "无法连接服务，请检查网络后重试" };
  } finally { clearTimeout(t); }
}

export interface User { id: number; email: string }
export interface Quota { used: number; limit: number }
type Auth = { token: string; user: User };
const post = <T,>(p: string, b: unknown, auth = false) => call<T>(p, { method: "POST", body: JSON.stringify(b) }, auth);
export const api = {
  me: () => call<{ user: User; quota: Quota }>("/api/auth/me"),
  sendCode: (email: string, purpose: "register" | "reset", website = "") => post<{ cooldown: number; dev?: boolean; dev_code?: string; retry_after?: number }>("/api/auth/send-code", { email, purpose, website }),
  register: (b: { email: string; code: string; password: string; website: string }) => post<Auth>("/api/auth/register", b),
  reset: (b: { email: string; code: string; password: string }) => post<Auth>("/api/auth/reset", b),
  login: (email: string, password: string) => post<Auth>("/api/auth/login", { email, password }),
  deleteAccount: () => call("/api/auth/account", { method: "DELETE" }),
  history: () => call<{ items: HistoryItem[] }>("/api/history"),
  historyItem: (id: number) => call<{ item: StoredItem }>(`/api/history/${id}`),
  deleteHistory: (id?: number) => call(id ? `/api/history/${id}` : "/api/history", { method: "DELETE" }),
};

/** History list row. Records saved before 2026-10-23 have `country`/`platform`/`risk` instead of `countries`/`verdicts`. */
export interface HistoryItem {
  id: number; created_at: number; title: string; description: string; image_count: number; cat_pred: Category | null;
  countries?: Country[]; verdicts?: Partial<Record<Country, string>>;
  country?: Country; platform?: Platform; risk?: string | null;
}

/** Normalise a stored result (new multi-country or old flat single-country) to the CheckResponse shape. */
export type StoredItem = HistoryItem & { result: (Partial<CheckResponse> & Partial<CountryResult> & { image_facts?: ImageFacts | null }) | null };
export function normalizeStored(item: StoredItem): CheckResponse {
  const r = item.result || {};
  if (r.results && Array.isArray(r.countries)) return r as CheckResponse;
  const c = (item.country || "TH") as Country;
  return {
    ok: true, model: r.model || "", latency_ms: r.latency_ms || 0, image_facts: r.image_facts || null, image_error: r.image_error || null,
    input: { title: item.title, description: item.description || "" }, countries: [c], results: { [c]: { ...(r as CountryResult), ok: true } },
  };
}
