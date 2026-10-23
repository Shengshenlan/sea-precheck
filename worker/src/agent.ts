import type { CheckInput } from "../../src/lib/core/types";
import { makeTools } from "./tools";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";

export interface LlmConfig { baseUrl: string; model: string; apiKey: string; timeoutMs: number; signal: AbortSignal; thinking?: Thinking }
export type Thinking = "off" | "low" | "high";
/** thinking on => reasoning tokens count against max_tokens, so give more room or content comes back empty. */
const maxTok = (t: Thinking) => (t === "off" ? 1500 : 6000);
export const resolveThinking = (v: string | undefined): Thinking => (v === "low" || v === "high" ? v : "off");
export interface AgentRun { text: string; toolCalls: string[]; impl: "pi" | "fetch" }
export class UpstreamError extends Error { constructor(public code: "quota" | "busy" | "auth" | "model" | "timeout" | "error", msg: string, public detail = "") { super(msg); } }


export function classifyUpstream(msg: string): UpstreamError {
  const e = classify(msg);
  e.detail = (msg.match(/\b(1\d{3}|[45]\d\d)\b/g) || []).join("/").slice(0, 20) || msg.replace(/[^A-Za-z ]/g, "").slice(0, 30); // status/code only, never content
  return e;
}
function classify(msg: string): UpstreamError {
  const m = msg.toLowerCase();
  // explicit Zhipu codes first (https://docs.bigmodel.cn/cn/faq/api-code)
  if (/\b(1302|1303|1305)\b/.test(m) || /速率限制|并发|too many requests/.test(m)) return new UpstreamError("busy", "upstream rate limited");
  if (/\b(1113|1308|1310)\b/.test(m) || /insufficient|欠费|余额|资源包|使用上限|quota/.test(m)) return new UpstreamError("quota", "upstream quota exhausted");
  if (/\b(1000|1001|1002|1003|1004)\b/.test(m) || /\b401\b|unauthor|api key|令牌/.test(m)) return new UpstreamError("auth", "upstream auth failed");
  if (/\b1211\b|model.*not exist|模型不存在/.test(m)) return new UpstreamError("model", "model not found");
  if (/\b429\b|rate/.test(m)) return new UpstreamError("busy", "upstream busy");
  if (/abort|timeout|timed out/.test(m)) return new UpstreamError("timeout", "upstream timeout");
  return new UpstreamError("error", "upstream error");
}

/**
 * Zhipu text models (e.g. glm-4-flash-250414) ignore OpenAI-style content-part arrays
 * ([{type:"text",text}]) and answer as if the message were empty. Flatten text-only parts to strings.
 */
export function flattenForZhipu(params: any, thinking: Thinking = "off") {
  // Zhipu thinking switch: GLM-4.5+/5.x think by default (slow). LLM_THINKING=off|low|high.
  if (params) {
    params.thinking = { type: thinking === "off" ? "disabled" : "enabled" };
    if (thinking === "off") delete params.reasoning_effort; else params.reasoning_effort = thinking;
  }
  for (const m of params?.messages || []) {
    if (Array.isArray(m.content) && m.content.every((p: any) => p?.type === "text")) m.content = m.content.map((p: any) => p.text).join("\n");
  }
  return params;
}

// ---------------- pi-mono implementation ----------------
export async function runPi(input: CheckInput, cfg: LlmConfig): Promise<AgentRun> {
  const { Agent } = await import("@mariozechner/pi-agent-core");
  const { streamSimple, Type } = await import("@mariozechner/pi-ai");
  const model: any = {
    id: cfg.model, name: cfg.model, api: "openai-completions", provider: "zhipu", baseUrl: cfg.baseUrl, reasoning: true,
    input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 4096,
    compat: { supportsStore: false, supportsDeveloperRole: false, maxTokensField: "max_tokens", thinkingFormat: "deepseek", supportsStrictMode: false },
  };
  const toolCalls: string[] = [];
  const tools = makeTools(input).map((t) => ({
    name: t.name, label: t.name, description: t.description,
    parameters: Type.Unsafe(t.parameters as any),
    execute: async (_id: string, params: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(t.run(params)) }], details: {} }),
  }));
  const agent = new Agent({
    initialState: { systemPrompt: SYSTEM_PROMPT, model, tools: tools as any },
    streamFn: (m: any, c: any, o: any) => streamSimple(m, c, {
      ...o, apiKey: cfg.apiKey, maxTokens: maxTok(cfg.thinking || "off"), timeoutMs: cfg.timeoutMs, maxRetries: 1, signal: cfg.signal,
      ...(cfg.thinking && cfg.thinking !== "off" ? { reasoning: cfg.thinking } : {}),
      onPayload: (p: any) => flattenForZhipu(p, cfg.thinking),
    }),
  } as any);
  const dbg = (globalThis as any).__PI_DEBUG;
  agent.subscribe((e: any) => { if (dbg) console.log("pi_evt", e.type, e.assistantMessageEvent?.type || ""); if (e.type === "tool_execution_start") toolCalls.push(e.toolName); if (toolCalls.length > 6) agent.abort(); });
  cfg.signal.addEventListener("abort", () => agent.abort());
  await agent.prompt(userPrompt(input));
  const last: any = agent.state.messages.at(-1);
  if (!last || last.stopReason === "error" || last.stopReason === "aborted") throw classifyUpstream(String(last?.errorMessage || last?.stopReason || "no response"));
  const text = (last.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  return { text, toolCalls, impl: "pi" };
}

// ---------------- thin fetch fallback (OpenAI-compatible tool loop) ----------------
export async function runFetch(input: CheckInput, cfg: LlmConfig): Promise<AgentRun> {
  const tools = makeTools(input);
  const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt(input) }];
  const toolCalls: string[] = [];
  for (let turn = 0; turn < 5; turn++) {
    const body: any = { model: cfg.model, messages, max_tokens: maxTok(cfg.thinking || "off"), temperature: 0.2,
      tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
    };
    flattenForZhipu(body, cfg.thinking);
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` }, body: JSON.stringify(body), signal: cfg.signal,
    }).catch((e) => { throw classifyUpstream(String(e?.name || e)); });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) throw classifyUpstream(`${res.status} ${j?.error?.code || ""} ${j?.error?.message || ""}`);
    const msg = j.choices?.[0]?.message;
    if (!msg) throw new UpstreamError("error", "empty response");
    if (msg.tool_calls?.length) {
      messages.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        const t = tools.find((x) => x.name === tc.function?.name); toolCalls.push(tc.function?.name);
        let args: unknown = {}; try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(t ? t.run(args) : { error: "unknown tool" }) });
      }
      continue;
    }
    return { text: msg.content || "", toolCalls, impl: "fetch" };
  }
  throw new UpstreamError("error", "too many tool turns");
}
