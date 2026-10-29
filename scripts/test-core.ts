/** Small deterministic regression checks for core matching (no network). Run: npm run test:core */
import { buildReport } from "../src/lib/core/match";
import { dryCellOnly, guardLlmSuggestions } from "../src/lib/core/guard";
import { summarize, splitInfo } from "../src/lib/core/verdict";
import { sanitizeInput } from "../src/lib/core/match";
import { visionBody, batchesOf, batchImages, mergeFacts, checkImages } from "../worker/src/vision";
import { resolveProvider, QWEN_DEFAULT_BASE_URL } from "../worker/src/provider";
import { flattenForZhipu, classifyUpstream } from "../worker/src/agent";
import type { CheckInput, ImageFacts } from "../src/lib/core/types";
import { readFileSync } from "node:fs";
import { composeCountries } from "../src/lib/report";

let fail = 0;
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const ids = (i: CheckInput, ov = {}) => { const r = buildReport(i, ov); return new Set([...r.certs, ...r.customs, ...r.display, ...r.platform].map((h) => h.rule.id)); };
const LI = ["ALL-LIBAT-UN383", "ALL-LIBAT-POWERBANK-UN3480", "ALL-LIBAT-CARRIER", "TH-TISI-BATTERY"];
const noLi = (s: Set<string>) => LI.every((x) => !s.has(x));

// dry-cell toys: no lithium rules
for (const c of ["TH", "PH", "MY"] as const) {
  const s = ids({ title: "儿童电动遥控车 使用4节AA碱性电池", country: c });
  ok(noLi(s), `${c}: AA alkaline RC car → no lithium rules`);
}
ok(noLi(ids({ title: "发光积木玩具 需2节AAA电池（不含）", country: "TH" })), "TH: 2节AAA → no lithium rules");
ok(noLi(ids({ title: "Musical toy drum, uses 3 x AA batteries", country: "PH" })), "PH: 3 x AA batteries → no lithium rules");
ok(noLi(ids({ title: "儿童玩具车 干电池款", country: "MY" }, { features: ["battery"], extraRuleIds: LI })), "MY: 干电池 + LLM extra ids → still none");
// lithium mentioned → rules stay
ok(ids({ title: "遥控车 内置锂电池 遥控器用AA电池", country: "TH" }).has("ALL-LIBAT-UN383"), "TH: 锂电池 + AA → UN38.3 kept");
ok(ids({ title: "儿童电动玩具车 USB充电 500mAh", country: "PH" }).has("ALL-LIBAT-UN383"), "PH: USB充电 500mAh → UN38.3 kept");
ok(ids({ title: "20000mAh 充电宝", country: "TH" }).has("ALL-LIBAT-POWERBANK-UN3480"), "TH: power bank → UN3480 kept");
ok(!dryCellOnly("AAA级品质 毛绒玩具"), "‘AAA级’ is not a battery");
ok(ids({ title: "Extension Cord 4 Gang with USB Ports 3 meters", country: "PH" }).has("PH-BPS-EXTENSION_CORD"), "PH: extension cord (rules only) → BPS extension cord");
ok(ids({ title: "Extension Cord 4 Gang with USB Ports 3 meters", country: "PH" }, { category: "appliance" }).has("PH-BPS-EXTENSION_CORD"), "PH: extension cord, LLM says appliance → still matched");
const g = guardLlmSuggestions("小火车玩具 3节5号电池", ["battery"], ["ALL-LIBAT-UN383"]);
ok(!g.extraRuleIds.length && g.removed.some((x) => x.what === "rule:ALL-LIBAT-UN383"), "guard removes LLM lithium rule for 5号电池");

// platform optional: all platform rules included, headline without platform
const r = buildReport({ title: "Nike 同款运动鞋 玩具", country: "TH" });
ok(r.platform.length >= 2, `no platform → ${r.platform.length} platform rules (all platforms)`);
ok(!/undefined/.test(r.conclusion.headline), "headline has no 'undefined'");
// verdicts
ok(summarize(buildReport({ title: "电饭煲 1.8L", country: "TH" })).verdict === "certs", "电饭煲 TH → 办证后可上架");
ok(summarize(buildReport({ title: "一次性电子烟 vape", country: "TH", category: "appliance" })).verdict === "no", "电子烟 → 不能销售");
const s = summarize(buildReport({ title: "电饭煲 1.8L", country: "MY" }));
ok(s.certs.length >= 1 && s.steps.length <= 3 && s.certs.every((c) => c.name && c.where), "certs have name + where; ≤3 steps");
ok(splitInfo("标题一行\n描述第二行\n第三行").title === "标题一行", "splitInfo first line = title");

// --- 10000-char 商品信息: nothing accepted is silently cut; the 10001st char is rejected by the worker, not trimmed here ---
{
  const long = "标题行\n" + "电热水壶 1.7L 不锈钢 220V。".repeat(1000); // ≈ 13k chars, cut to the limit below
  const info = long.slice(0, 10000); const sp = splitInfo(info);
  const inp = sanitizeInput({ title: sp.title, description: sp.description, country: "TH" });
  ok(`${inp.title}\n${inp.description}`.length >= info.trim().length - 1, "10000-char info survives splitInfo + sanitizeInput untouched");
  ok(sanitizeInput({ ...splitInfo("标题\n" + "长".repeat(9990)), country: "TH" }).description?.length === 9990, "9990-char description kept in full");
  const one = splitInfo("x".repeat(9999)); ok(one.title.length === 200 && one.description.length === 9799, "single 9999-char line: title 200 + rest 9799, no loss");
}
// --- vision batching / merging ---
ok(JSON.stringify(batchesOf(Array.from({ length: 10 }, (_, i) => i)).map((b) => b.length)) === "[4,3,3]", "10 images → batches 4/3/3");
ok(JSON.stringify(batchesOf([1, 2, 3, 4, 5]).map((b) => b.length)) === "[3,2]" && batchesOf([1, 2, 3, 4]).length === 1 && batchesOf([]).length === 0, "5 → 3/2, 4 → one batch, 0 → none");
{
  const f = (o: Partial<ImageFacts>): ImageFacts => ({ product_type: "", brands: [], marks: [], plug_type: null, battery: null, wireless: null, wireless_evidence: "", label_text: "", label_langs: [], notes: "", model: "m", images: 4, ...o });
  const m = mergeFacts([f({ product_type: "移动电源", brands: ["A"], marks: ["TISI"], battery: false, label_text: "L1", label_langs: ["en"] }), f({ brands: ["A", "B"], marks: ["CE"], battery: true, wireless: true, wireless_evidence: "Qi", label_langs: ["th"], images: 3 })], 10);
  ok(m.product_type === "移动电源" && m.brands.join() === "A,B" && m.marks.join() === "TISI,CE" && m.battery === true && m.wireless === true && m.wireless_evidence === "Qi", "mergeFacts: union, any-true wins, evidence kept");
  ok(m.images === 10 && m.images_failed === 3 && m.label_langs.join() === "en,th", "mergeFacts: counts failed images (10 sent, 7 read)");
}
const px = "data:image/jpeg;base64," + "A".repeat(1000);
ok(checkImages(Array(5).fill(px)) === null && !!checkImages(Array(6).fill(px)), "checkImages: 5 ok, 6 rejected");
const b64 = (mb: number) => `data:image/jpeg;base64,${"A".repeat(Math.ceil((mb * 1048576) / 3) * 4)}`;
ok(checkImages([b64(4.9)]) === null && /5MB/.test(checkImages([b64(5.1)]) || ""), "checkImages: 4.9MB ok, 5.1MB → 「单张图片不能超过 5MB」");
ok(checkImages(Array(5).fill(b64(4.9))) === null, "checkImages: 5 × 4.9MB (≈24.5MB) accepted");
ok(!!checkImages(Array(3).fill(b64(4.9)), 5 * 1048576, 5, 10 * 1048576), "checkImages: total cap enforced when lowered");
{
  const bd = JSON.parse(visionBody([px, px], "glm-x"));
  ok(bd.model === "glm-x" && bd.messages[0].content.length === 3 && bd.messages[0].content[0].image_url.url === px && bd.messages[0].content[2].type === "text", "visionBody: spliced body is valid JSON with the images intact");
  ok(!!checkImages(['data:image/jpeg;base64,AA"},{"x":"']) && JSON.parse(visionBody(['data:image/jpeg;base64,AA"x'], "m")).messages[0].content[0].image_url.url.endsWith('AA"x'), "quotes in a data URL are refused by checkImages and escaped by visionBody (no injection)");
}
ok(JSON.stringify(batchImages(Array(5).fill(px)).map((b) => b.length)) === "[3,2]", "small images: 5 → batches 3/2");
ok(JSON.stringify(batchImages(Array(5).fill(b64(4.9))).map((b) => b.length)) === "[1,1,1,1,1]", "5 × 4.9MB originals → one image per vision request (≤ ~9MB each)");
ok(JSON.stringify(batchImages([b64(1), b64(1), b64(1), b64(5), b64(1)]).map((b) => b.length)) === "[3,2]" || batchImages([b64(1), b64(1), b64(1), b64(5), b64(1)]).every((b) => b.length <= 4), "mixed sizes: batches stay ≤ 4 images");

// ---- LLM provider switch (LLM_PROVIDER=zhipu default | qwen) ----
{
  const base = { LLM_BASE_URL: "https://zp/v4", LLM_MODEL: "glm-x", ZHIPUAI_API_KEY: "zk", QWEN_API_KEY: "qk" };
  const z = resolveProvider(base);
  ok(z.provider === "zhipu" && z.baseUrl === "https://zp/v4" && z.model === "glm-x" && z.apiKey === "zk" && z.visionBaseUrl === "https://zp/v4" && z.visionModel === "glm-5.3-flash", "provider: unset → zhipu with the existing vars (unchanged)");
  ok(resolveProvider({ ...base, LLM_PROVIDER: "zhipu", VISION_BASE_URL: "https://v", VISION_MODEL: "glm-v" }).visionModel === "glm-v", "provider: zhipu honours VISION_* vars");
  ok(resolveProvider({ ...base, LLM_PROVIDER: "bogus" }).provider === "zhipu", "provider: unknown value falls back to zhipu");
  const q = resolveProvider({ ...base, LLM_PROVIDER: " Qwen " });
  ok(q.provider === "qwen" && q.baseUrl === QWEN_DEFAULT_BASE_URL && q.visionBaseUrl === QWEN_DEFAULT_BASE_URL && q.model === "qwen-plus" && q.visionModel === "qwen3-vl-plus" && q.apiKey === "qk", "provider: qwen → DashScope compatible-mode defaults + QWEN_API_KEY");
  ok(resolveProvider({ ...base, LLM_PROVIDER: "qwen", QWEN_MODEL: "qwen3.7-plus", QWEN_VISION_MODEL: "qwen3.7-plus" }).visionModel === "qwen3.7-plus", "provider: qwen honours QWEN_MODEL / QWEN_VISION_MODEL");
  ok(resolveProvider({ ...base, LLM_PROVIDER: "qwen", QWEN_API_KEY: undefined }).apiKey === undefined, "provider: qwen without QWEN_API_KEY → no key (does not fall back to the Zhipu key)");
  const zb = JSON.parse(visionBody([px], "glm-x")), qb = JSON.parse(visionBody([px], "qwen3-vl-plus", "qwen"));
  ok(zb.thinking?.type === "disabled" && !("enable_thinking" in zb), "visionBody(zhipu): thinking disabled (unchanged)");
  ok(qb.enable_thinking === false && !("thinking" in qb) && qb.messages[0].content[0].image_url.url === px, "visionBody(qwen): enable_thinking=false, valid JSON");
  ok(JSON.parse(visionBody(['data:image/jpeg;base64,AA"x'], "m", "qwen")).enable_thinking === false, "visionBody(qwen): escaped fallback path too");
  const pz = flattenForZhipu({ messages: [{ role: "user", content: [{ type: "text", text: "a" }] }] }, "off");
  ok(pz.thinking.type === "disabled" && pz.messages[0].content === "a", "payload(zhipu): thinking disabled + text parts flattened (unchanged)");
  const pq = flattenForZhipu({ thinking: { type: "enabled" }, reasoning_effort: "low", messages: [] }, "off", "qwen");
  ok(pq.enable_thinking === false && !("thinking" in pq) && !("reasoning_effort" in pq), "payload(qwen): enable_thinking=false, no Zhipu thinking field");
  ok(flattenForZhipu({ messages: [] }, "high", "qwen").enable_thinking === true, "payload(qwen): LLM_THINKING=high → enable_thinking=true");
  ok(classifyUpstream("401 invalid_api_key Incorrect API key provided.").code === "auth", "classify: DashScope invalid_api_key → auth");
  ok(classifyUpstream("400 Arrearage Access denied, please make sure your account is in good standing.").code === "quota", "classify: DashScope Arrearage → quota");
  ok(classifyUpstream("404 model_not_found The model `qwen-x` does not exist").code === "model", "classify: DashScope model_not_found → model");
  ok(classifyUpstream("429 Throttling Requests rate limit exceeded").code === "busy", "classify: DashScope 429 → busy");
}

// ---- /demo/ snapshot: a frozen REAL check result must still render through the same composition path as the signed-in page ----
{
  const snap = JSON.parse(readFileSync("src/data/demo-check.json", "utf8"));
  const views = composeCountries(snap.response);
  ok(views.length === 2 && views.map((v) => v.country).join() === "TH,MY" && views.every((v) => v.aiOk), "demo snapshot: TH + MY composed, AI part ok");
  ok(views.every((v) => v.summary.verdict === "certs" && v.summary.certs.length >= 1 && v.summary.steps.length >= 1 && v.summary.steps.length <= 3), "demo snapshot: verdict 办证后可上架, certs and ≤3 steps present");
  ok(!/sk-|api[_-]?key|bearer|token/i.test(JSON.stringify(snap)), "demo snapshot: no secrets / tokens inside");
}

console.log(fail ? `\n${fail} failed` : "\nall passed");
process.exit(fail ? 1 : 0);
