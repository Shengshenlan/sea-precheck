import type { CheckInput, Category, Feature, LlmNote } from "./core/types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export interface LlmResponse {
  ok: true; model: string; category: Category | null; features: Feature[]; items: string[];
  extra_rule_ids: string[]; notes: LlmNote[]; next_steps: string[]; summary: string; latency_ms: number; dropped: number;
}
export type LlmResult = LlmResponse | { ok: false; reason: "disabled" | "rate_limited" | "quota" | "timeout" | "error"; message: string };

export async function fetchLlm(input: CheckInput, signal?: AbortSignal): Promise<LlmResult> {
  if (!API_URL) return { ok: false, reason: "disabled", message: "未配置 AI 后端，当前为纯规则结果。" };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60000);
  signal?.addEventListener("abort", () => ctl.abort());
  try {
    const res = await fetch(`${API_URL}/api/check`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal: ctl.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 429) return { ok: false, reason: "rate_limited", message: body.message || "AI 分析次数已达上限（每个 IP 每小时有限额），稍后再试。以下为纯规则结果。" };
    if (res.status === 503 && body.code === "quota") return { ok: false, reason: "quota", message: body.message || "AI 免费额度已用完，以下为纯规则结果。" };
    if (!res.ok || !body.ok) return { ok: false, reason: "error", message: body.message || `AI 后端暂不可用（HTTP ${res.status}），以下为纯规则结果。` };
    return body as LlmResponse;
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return { ok: false, reason: aborted ? "timeout" : "error", message: aborted ? "AI 分析超时，以下为纯规则结果。" : "无法连接 AI 后端（网络问题），以下为纯规则结果。" };
  } finally { clearTimeout(t); }
}
