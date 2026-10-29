/**
 * LLM provider selection. LLM_PROVIDER = "zhipu" (default) | "qwen".
 * Both are OpenAI-compatible /chat/completions endpoints, so agent.ts / vision.ts are shared; only the
 * base URL, model names, API key and the "thinking" switch differ.
 *  - zhipu: LLM_BASE_URL / LLM_MODEL / VISION_BASE_URL / VISION_MODEL, secret ZHIPUAI_API_KEY (unchanged behaviour)
 *  - qwen : Alibaba Cloud Model Studio (百炼 / DashScope) OpenAI-compatible mode, secret QWEN_API_KEY,
 *           QWEN_BASE_URL / QWEN_MODEL / QWEN_VISION_MODEL (defaults below)
 */
export type Provider = "zhipu" | "qwen";

export const QWEN_DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
/** qwen-plus: stable alias of the Qwen Plus series (hybrid thinking, off by default). */
export const QWEN_DEFAULT_MODEL = "qwen-plus";
/** qwen3-vl-plus: Qwen3-VL vision model (hybrid thinking, off by default). */
export const QWEN_DEFAULT_VISION_MODEL = "qwen3-vl-plus";
export const ZHIPU_DEFAULT_VISION_MODEL = "glm-5.3-flash";

export interface ProviderEnv {
  LLM_PROVIDER?: string;
  ZHIPUAI_API_KEY?: string; LLM_BASE_URL: string; LLM_MODEL: string; VISION_BASE_URL?: string; VISION_MODEL?: string;
  QWEN_API_KEY?: string; QWEN_BASE_URL?: string; QWEN_MODEL?: string; QWEN_VISION_MODEL?: string;
}
export interface ProviderConfig { provider: Provider; apiKey?: string; baseUrl: string; model: string; visionBaseUrl: string; visionModel: string }

export const resolveProviderName = (v: string | undefined): Provider => ((v || "").trim().toLowerCase() === "qwen" ? "qwen" : "zhipu");

export function resolveProvider(env: ProviderEnv): ProviderConfig {
  if (resolveProviderName(env.LLM_PROVIDER) === "qwen") {
    const baseUrl = env.QWEN_BASE_URL || QWEN_DEFAULT_BASE_URL;
    return { provider: "qwen", apiKey: env.QWEN_API_KEY, baseUrl, model: env.QWEN_MODEL || QWEN_DEFAULT_MODEL,
      visionBaseUrl: baseUrl, visionModel: env.QWEN_VISION_MODEL || QWEN_DEFAULT_VISION_MODEL };
  }
  return { provider: "zhipu", apiKey: env.ZHIPUAI_API_KEY, baseUrl: env.LLM_BASE_URL, model: env.LLM_MODEL,
    visionBaseUrl: env.VISION_BASE_URL || env.LLM_BASE_URL, visionModel: env.VISION_MODEL || ZHIPU_DEFAULT_VISION_MODEL };
}
