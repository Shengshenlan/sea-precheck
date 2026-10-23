import type { ImageFacts } from "../../src/lib/core/types";
import { classifyUpstream, UpstreamError } from "./agent";

export interface VisionConfig { baseUrl: string; model: string; apiKey: string; signal: AbortSignal }

export const MAX_IMAGES = 3;
export const MAX_IMAGE_B64 = 900 * 1024;      // per image (base64 chars) ~ 675 KB binary
export const MAX_IMAGES_B64_TOTAL = 2_000_000; // ~1.5 MB binary in total
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Returns an error message (Chinese) or null if the images are acceptable. */
export function checkImages(images: unknown): string | null {
  if (images == null) return null;
  if (!Array.isArray(images)) return "图片格式错误";
  if (images.length > MAX_IMAGES) return `最多上传 ${MAX_IMAGES} 张图片`;
  let total = 0;
  for (const im of images) {
    if (typeof im !== "string" || !DATA_URL.test(im)) return "只支持 jpg / png / webp 图片";
    if (im.length > MAX_IMAGE_B64) return "单张图片过大，请压缩后再上传";
    total += im.length;
  }
  return total > MAX_IMAGES_B64_TOTAL ? "图片总大小超过 1.5MB" : null;
}

export const KNOWN_MARKS = ["TISI", "SIRIM", "ST", "ICC", "PS", "NTC", "NBTC", "MCMC", "FDA", "Halal", "CE", "FCC", "UKCA", "RoHS", "CCC", "PSE", "KC", "UL", "SNI", "WEEE", "Recycle"];

const PROMPT = `你是跨境电商商品图片信息提取器。只描述图片中【实际看得见】的内容，看不清或没有就留空/null，不要猜测，不要做合规判断。
只输出一个 JSON 对象，不要 markdown：
{"product_type":"中文商品类型，如 电热水壶/移动电源/遥控玩具车/面霜","brands":["图片上可见的品牌名或品牌 logo 文字"],
"marks":["可见的认证/合规标志，只用这些代码：${KNOWN_MARKS.join("/")}；泰国 มอก. 标志写 TISI；马来西亚 SIRIM 或 ST-SIRIM 写 SIRIM；菲律宾 PS/ICC 写 ICC"],
"plug_type":"可见插头类型如 UK/EU/US/Type-C，没有就 null","battery":true/false/null,"wireless":true/false/null,
"wireless_evidence":"若 wireless=true，逐字抄写图片上证明有蓝牙/WiFi/2.4GHz遥控/无线充电的文字，例如 Bluetooth 5.3、2.4GHz Remote Control、Magnetic Wireless Charging；注意 Cordless/无线吸尘器 只表示无电线，不算 wireless",
"label_text":"逐字抄写包装/标签上最重要的文字（不超过 300 字）","label_langs":["标签文字语言代码，如 zh/en/th/ms/fil"],"notes":"其他值得注意的可见信息，不超过 60 字"}`;

const s = (v: unknown, n: number) => (typeof v === "string" ? v : "").slice(0, n);
const arr = (v: unknown, n: number, len = 40) => (Array.isArray(v) ? v.map((x) => s(x, len)).filter(Boolean).slice(0, n) : []);
const tri = (v: unknown) => (v === true ? true : v === false ? false : null);

export function normalizeFacts(raw: any, model: string, images: number): ImageFacts {
  const marks = arr(raw?.marks, 12, 20).map((m) => {
    const u = m.toUpperCase().replace(/[^A-Z]/g, "");
    if (/มอก|TIS/.test(m.toUpperCase()) || u === "TISI") return "TISI";
    if (u.includes("SIRIM")) return "SIRIM";
    if (u === "PSICC" || u === "ICC") return "ICC";
    return KNOWN_MARKS.find((k) => k.toUpperCase() === u) || "";
  }).filter(Boolean);
  return {
    product_type: s(raw?.product_type, 40), brands: arr(raw?.brands, 6), marks: [...new Set(marks)], plug_type: s(raw?.plug_type, 20) || null,
    battery: tri(raw?.battery), wireless: tri(raw?.wireless), wireless_evidence: s(raw?.wireless_evidence, 120),
    label_text: s(raw?.label_text, 400), label_langs: arr(raw?.label_langs, 6, 5).map((x) => x.toLowerCase()), notes: s(raw?.notes, 120), model, images,
  };
}

export async function runVision(images: string[], cfg: VisionConfig, parse: (t: string) => any): Promise<ImageFacts> {
  const body = {
    model: cfg.model, max_tokens: 1200, temperature: 0.1, thinking: { type: "disabled" },
    messages: [{ role: "user", content: [...images.map((url) => ({ type: "image_url", image_url: { url } })), { type: "text", text: PROMPT }] }],
  };
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` }, body: JSON.stringify(body), signal: cfg.signal,
  }).catch((e) => { throw classifyUpstream(String(e?.name || e)); });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw classifyUpstream(`${res.status} ${j?.error?.code || ""} ${j?.error?.message || ""}`);
  const parsed = parse(String(j.choices?.[0]?.message?.content || ""));
  if (!parsed) throw new UpstreamError("error", "vision output unparseable", "parse");
  return normalizeFacts(parsed, cfg.model, images.length);
}

/** Human-readable evidence block for the text LLM prompt. */
export function factsForPrompt(f: ImageFacts): string {
  return [`商品类型：${f.product_type || "未知"}`, `可见品牌：${f.brands.join("、") || "无"}`, `可见标志：${f.marks.join("、") || "无"}`,
    `插头：${f.plug_type || "未见"}`, `电池：${f.battery == null ? "未知" : f.battery ? "有" : "无"}`,
    `无线功能：${f.wireless == null ? "未知" : f.wireless ? `有（${f.wireless_evidence}）` : "无"}`, `标签文字：${f.label_text}`, `标签语言：${f.label_langs.join("/") || "未知"}`].join("\n");
}
