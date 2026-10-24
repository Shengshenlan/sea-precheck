import type { ImageFacts } from "../../src/lib/core/types";
import { classifyUpstream, UpstreamError } from "./agent";
import { markWithCountry } from "../../src/lib/core/marks";

export interface VisionConfig { baseUrl: string; model: string; apiKey: string; signal: AbortSignal }

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // per image, decoded bytes (clients send the original unless it is over this cap)
export const MAX_TOTAL_IMAGE_BYTES = MAX_IMAGES * MAX_IMAGE_BYTES; // all images of one check, decoded bytes (worst case ≈ 33MB of base64 JSON)
export const VISION_BATCH = 4; // images per vision request; batches run in parallel
export const VISION_BATCH_B64 = 9_000_000; // …and at most ~9MB of base64 per vision request, so big originals go out in smaller batches
export const VISION_TIMEOUT_MS = 25_000; // budget for the whole vision stage; whatever succeeded by then is used
// Cheap prefix check only: a full-string regex over several MB of base64 would burn Workers CPU (Free plan: 10ms). Bad payloads are rejected by the vision API and degrade to text-only.
const DATA_URL_HEAD = /^data:image\/(jpeg|png|webp);base64,/;
/** Decoded size of a base64 data URL without decoding it. */
export const dataUrlBytes = (u: string) => { const b = u.slice(u.indexOf(",") + 1); return Math.floor((b.length * 3) / 4) - (b.endsWith("==") ? 2 : b.endsWith("=") ? 1 : 0); };

/** Returns an error message (Chinese) or null if the images are acceptable. */
export function checkImages(images: unknown, maxBytes = MAX_IMAGE_BYTES, maxCount = MAX_IMAGES, maxTotal = MAX_TOTAL_IMAGE_BYTES): string | null {
  if (images == null) return null;
  if (!Array.isArray(images)) return "图片格式错误";
  if (images.length > maxCount) return `最多上传 ${maxCount} 张图片`;
  let total = 0;
  for (const im of images) {
    if (typeof im !== "string" || im.length > Math.ceil(maxBytes / 3) * 4 + 64) return typeof im === "string" ? `单张图片不能超过 ${(maxBytes / 1048576).toFixed(0)}MB，请压缩后再上传` : "图片格式错误";
    if (!DATA_URL_HEAD.test(im.slice(0, 40))) return "只支持 jpg / png / webp 图片";
    if (!jsonSafe(im)) return "图片格式错误";
    const n = dataUrlBytes(im);
    if (n > maxBytes) return `单张图片不能超过 ${(maxBytes / 1048576).toFixed(0)}MB，请压缩后再上传`;
    total += n;
  }
  if (total > maxTotal) return `图片总大小不能超过 ${(maxTotal / 1048576).toFixed(0)}MB，请减少图片数量或压缩后再上传`;
  return null;
}

export const KNOWN_MARKS = ["TISI", "SIRIM", "ST", "ICC", "PS", "NTC", "NBTC", "MCMC", "FDA", "Halal", "CE", "FCC", "UKCA", "RoHS", "CCC", "PSE", "KC", "UL", "SNI", "WEEE", "Recycle"];

const PROMPT = `你是跨境电商商品图片信息提取器。只描述图片中【实际看得见】的内容，看不清或没有就留空/null，不要猜测，不要做合规判断。可能有多张图片（同一商品的不同角度/包装/标签），请合并所有图片中可见的信息。
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

/** One vision request for ≤ VISION_BATCH images. */
/** True when a (checked) data URL can be spliced into JSON as-is: no quote / backslash, so it can not break out of the string. */
const jsonSafe = (s: string) => s.indexOf('"') < 0 && s.indexOf("\\") < 0;
/**
 * Request body as a string. The base64 data URLs are spliced in as they are (checkImages guarantees they contain no quote or backslash)
 * instead of going through JSON.stringify, which would re-scan up to ~25MB of base64 and cost real CPU on the Workers Free plan.
 */
export function visionBody(images: string[], model: string): string {
  const text = JSON.stringify({ type: "text", text: PROMPT });
  if (!images.every(jsonSafe)) {
    return JSON.stringify({ model, max_tokens: 1200, temperature: 0.1, thinking: { type: "disabled" }, messages: [{ role: "user", content: [...images.map((url) => ({ type: "image_url", image_url: { url } })), JSON.parse(text)] }] });
  }
  const parts = images.map((im) => `{"type":"image_url","image_url":{"url":"${im}"}}`);
  return `{"model":${JSON.stringify(model)},"max_tokens":1200,"temperature":0.1,"thinking":{"type":"disabled"},"messages":[{"role":"user","content":[${parts.join(",")},${text}]}]}`;
}

export async function runVision(images: string[], cfg: VisionConfig, parse: (t: string) => any): Promise<ImageFacts> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` }, body: visionBody(images, cfg.model), signal: cfg.signal,
  }).catch((e) => { throw classifyUpstream(String(e?.name || e)); });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw classifyUpstream(`${res.status} ${j?.error?.code || ""} ${j?.error?.message || ""}`);
  const parsed = parse(String(j.choices?.[0]?.message?.content || ""));
  if (!parsed) throw new UpstreamError("error", "vision output unparseable", "parse");
  return normalizeFacts(parsed, cfg.model, images.length);
}

/** Human-readable evidence block for the text LLM prompt. */
export function factsForPrompt(f: ImageFacts): string {
  return [`商品类型：${f.product_type || "未知"}`, `可见品牌：${f.brands.join("、") || "无"}`, `可见标志（国别按知识库映射）：${f.marks.map(markWithCountry).join("、") || "无"}`,
    `插头：${f.plug_type || "未见"}`, `电池：${f.battery == null ? "未知" : f.battery ? "有" : "无"}`,
    `无线功能：${f.wireless == null ? "未知" : f.wireless ? `有（${f.wireless_evidence}）` : "无"}`, `标签文字：${f.label_text}`, `标签语言：${f.label_langs.join("/") || "未知"}`].join("\n");
}

/**
 * Split images into vision batches of ≤ `size` images and ≤ `maxChars` base64 chars each, in order.
 * Small images: the fewest, evenly sized batches (5 → 3/2, 4 → one batch). Big originals: greedy, so a batch never carries much more than `maxChars`.
 */
export function batchImages(images: string[], size = VISION_BATCH, maxChars = VISION_BATCH_B64): string[][] {
  if (images.reduce((a, s) => a + s.length, 0) <= maxChars) return batchesOf(images, size);
  const out: string[][] = []; let cur: string[] = []; let n = 0;
  for (const im of images) {
    if (cur.length && (cur.length >= size || n + im.length > maxChars)) { out.push(cur); cur = []; n = 0; }
    cur.push(im); n += im.length;
  }
  if (cur.length) out.push(cur);
  return out;
}
/** Split items into the fewest batches of ≤ size, as even as possible (10 → 4/3/3, 5 → 3/2). */
export function batchesOf<T>(items: T[], size = VISION_BATCH): T[][] {
  if (!items.length) return [];
  const nb = Math.ceil(items.length / size), base = Math.floor(items.length / nb), extra = items.length % nb;
  const out: T[][] = []; let at = 0;
  for (let b = 0; b < nb; b++) { const n = base + (b < extra ? 1 : 0); out.push(items.slice(at, at + n)); at += n; }
  return out;
}

const uniq = (xs: string[], n: number) => [...new Set(xs.filter(Boolean))].slice(0, n);
/**
 * Merge per-batch facts into one ImageFacts. Conservative: battery / wireless are true if any batch saw them (wireless keeps its verbatim
 * evidence, and the guard still requires that evidence); false only when no batch said true; otherwise unknown.
 */
export function mergeFacts(parts: ImageFacts[], totalImages: number): ImageFacts {
  if (parts.length === 1) return { ...parts[0], images: totalImages, images_failed: totalImages - parts[0].images || undefined };
  const tri = (k: "battery" | "wireless") => (parts.some((p) => p[k] === true) ? true : parts.some((p) => p[k] === false) ? false : null);
  const okImages = parts.reduce((a, p) => a + p.images, 0);
  const wl = parts.find((p) => p.wireless === true && p.wireless_evidence);
  return {
    product_type: parts.find((p) => p.product_type)?.product_type || "",
    brands: uniq(parts.flatMap((p) => p.brands), 6), marks: uniq(parts.flatMap((p) => p.marks), 12),
    plug_type: parts.find((p) => p.plug_type)?.plug_type || null, battery: tri("battery"), wireless: tri("wireless"),
    wireless_evidence: wl ? wl.wireless_evidence : "",
    label_text: parts.map((p) => p.label_text).filter(Boolean).join("\n").slice(0, 1000),
    label_langs: uniq(parts.flatMap((p) => p.label_langs), 6), notes: parts.map((p) => p.notes).filter(Boolean).join("；").slice(0, 200),
    model: parts[0].model, images: totalImages, images_failed: totalImages - okImages || undefined,
  };
}

export interface VisionOutcome { facts: ImageFacts | null; failed: number; error: string | null; batches: number }
/**
 * Vision stage for up to MAX_IMAGES images: batches of ≤ VISION_BATCH run in parallel, each with one retry on a busy upstream.
 * The whole stage has its own budget (`timeoutMs`); batches that fail or run out of time are dropped and the rest is merged,
 * so a slow or broken vision model degrades to "text + whatever image info succeeded" instead of failing the check.
 */
export async function runVisionAll(images: string[], cfg: Omit<VisionConfig, "signal"> & { signal: AbortSignal }, parse: (t: string) => any, timeoutMs = VISION_TIMEOUT_MS,
  onError?: (code: string, detail: string) => void): Promise<VisionOutcome> {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort(); cfg.signal.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const batches = batchImages(images);
  try {
    const run = async (b: string[], i: number) => {
      if (i) await new Promise((r) => setTimeout(r, 250 * i)); // stagger a little to avoid upstream concurrency spikes
      try { return await runVision(b, { ...cfg, signal: ctl.signal }, parse); }
      catch (e) {
        if (e instanceof UpstreamError && e.code === "busy" && !ctl.signal.aborted) { await new Promise((r) => setTimeout(r, 2000)); return await runVision(b, { ...cfg, signal: ctl.signal }, parse); }
        throw e;
      }
    };
    const settled = await Promise.allSettled(batches.map(run));
    const ok: ImageFacts[] = []; let error: string | null = null;
    settled.forEach((s) => {
      if (s.status === "fulfilled") { ok.push(s.value); return; }
      const code = s.reason instanceof UpstreamError ? s.reason.code : ctl.signal.aborted ? "timeout" : "error";
      error ||= code; onError?.(code, s.reason instanceof UpstreamError ? s.reason.detail : "");
    });
    const facts = ok.length ? mergeFacts(ok, images.length) : null;
    return { facts, failed: images.length - ok.reduce((a, p) => a + p.images, 0), error: ok.length === batches.length ? null : error || "error", batches: batches.length };
  } finally { clearTimeout(timer); cfg.signal.removeEventListener("abort", onAbort); }
}
