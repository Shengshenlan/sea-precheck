import { kb } from "./kb";
import { detectCategory, detectFeatures, detectItems, findTerms, COSMETIC_RISK_TERMS, ITEM_ZH } from "./detect";
import { checkBrandWords, ipLinks } from "./brands";
import type { Category, CheckInput, Feature, Report, ReviewItem, Rule, RuleHit } from "./types";

export const COUNTRY_ZH = { TH: "泰国", PH: "菲律宾", MY: "马来西亚", ID: "印尼", VN: "越南", ALL: "通用" } as const;
export const CATEGORY_ZH: Record<Category, string> = { appliance: "小家电", power: "充电器/电源适配器/移动电源", toy: "玩具", cosmetic: "化妆品" };
export const PLATFORM_ZH = { tiktok: "TikTok Shop", shopee: "Shopee", lazada: "Lazada" } as const;
export const MAX_TITLE = 200, MAX_DESC = 2000;

export function sanitizeInput(i: CheckInput): CheckInput {
  return {
    title: String(i.title || "").slice(0, MAX_TITLE).trim(),
    description: String(i.description || "").slice(0, MAX_DESC).trim(),
    category: (["appliance", "power", "toy", "cosmetic", "auto"] as const).includes(i.category as never) ? i.category : "auto",
    country: (["TH", "PH", "MY"] as const).includes(i.country) ? i.country : "TH",
    platform: (["tiktok", "shopee", "lazada"] as const).includes(i.platform) ? i.platform : "shopee",
  };
}

export interface MatchOverrides { category?: Category; features?: Feature[]; items?: string[]; extraRuleIds?: string[]; imageText?: string }

/** Flatten vision facts into evidence text for deterministic keyword matching (source = image). */
export function imageEvidenceText(f: { product_type?: string; brands?: string[]; label_text?: string; wireless?: boolean | null; wireless_evidence?: string; battery?: boolean | null } | null | undefined): string {
  if (!f) return "";
  return [f.product_type, ...(f.brands || []), f.label_text, f.wireless ? f.wireless_evidence : "", f.battery ? "battery" : ""].filter(Boolean).join("\n").slice(0, 1500);
}

/** Rules applicable to a country/category regardless of item/feature (used to bound LLM extra_rule_ids). */
export function candidateRules(country: string, category: Category | null): Rule[] {
  return kb.rules.filter((r) => (r.country === country || r.country === "ALL") && (r.categories.includes("*") || (category != null && r.categories.includes(category))));
}

export function buildReport(raw: CheckInput, ov: MatchOverrides = {}): Report {
  const input = sanitizeInput(raw);
  const text = `${input.title}\n${input.description || ""}`;
  let category: Category | null = null; let category_source: Report["category_source"] = "none";
  if (ov.category) { category = ov.category; category_source = "llm"; }
  else if (input.category && input.category !== "auto") { category = input.category; category_source = "user"; }
  else { category = detectCategory(text).category || (ov.imageText ? detectCategory(`${text}\n${ov.imageText}`).category : null); category_source = category ? "auto" : "none"; }
  if (input.category && input.category !== "auto") { category = input.category; category_source = "user"; }

  const img = ov.imageText || "";
  const fdText = detectFeatures(text);
  const fd = [...fdText, ...(img ? detectFeatures(img).filter((x) => !fdText.some((y) => y.feature === x.feature)).map((x) => ({ ...x, term: `图片：${x.term}` })) : [])];
  const features = new Set<Feature>([...fd.map((f) => f.feature), ...(ov.features || [])]);
  const featTerm = (f: Feature) => fd.find((x) => x.feature === f)?.term ?? "模型识别";
  const itemsT = detectItems(text);
  const itemsD = [...itemsT, ...(img ? detectItems(img).filter((x) => !itemsT.some((y) => y.item === x.item)).map((x) => ({ ...x, term: `图片：${x.term}` })) : [])];
  const items = new Set<string>([...itemsD.map((x) => x.item), ...(ov.items || [])]);
  if (category === "power" && /插线板|延长线|排插|extension/i.test(text)) items.add("extension_cord");
  if (category === "power" && !features.has("charger") && !features.has("powerbank")) {
    if (/充电宝|移动电源|power ?bank/i.test(`${text}\n${img}`)) features.add("powerbank"); else features.add("charger");
  }

  const review: ReviewItem[] = [];
  const hits = new Map<string, RuleHit>();
  const add = (r: Rule, reason: string) => { if (!hits.has(r.id)) hits.set(r.id, { rule: r, reason }); };
  const catOk = (r: Rule) => r.categories.includes("*") || (category != null && r.categories.includes(category));

  for (const r of kb.rules) {
    if (r.country !== input.country && r.country !== "ALL") continue;
    if (!catOk(r) || r.requires_cert_prefix) continue;
    if (r.platforms.length && !r.platforms.includes(input.platform)) continue;
    if (r.items.length) {
      const it = r.items.find((i) => items.has(i)); if (!it) continue;
      const term = itemsD.find((x) => x.item === it)?.term ?? "模型识别";
      add(r, `识别到品类“${ITEM_ZH[it] || it}”（关键词：${term}）`); continue;
    }
    if (r.features.length) {
      const f = r.features.find((x) => features.has(x)); if (!f) continue;
      add(r, f === "wireless" ? `识别到无线功能（关键词：${featTerm(f)}）` : `识别到子类：${f === "charger" ? "充电器/适配器" : f === "powerbank" ? "移动电源" : f}（关键词：${featTerm(f)}）`); continue;
    }
    if (r.kind === "platform") { add(r, `所选平台：${PLATFORM_ZH[input.platform]}`); continue; }
    add(r, category ? `${COUNTRY_ZH[input.country]} · ${CATEGORY_ZH[category]}` : COUNTRY_ZH[input.country]);
  }
  for (const id of ov.extraRuleIds || []) {
    const r = kb.rules.find((x) => x.id === id);
    if (r && (r.country === input.country || r.country === "ALL") && catOk(r) && !r.requires_cert_prefix) add(r, "模型补充（规则本身来自知识库）");
  }
  const certIds = [...hits.values()].filter((h) => h.rule.kind === "cert").map((h) => h.rule.id);
  for (const r of kb.rules) if (r.requires_cert_prefix && r.country === input.country && catOk(r)) {
    if (certIds.some((id) => id.startsWith(r.requires_cert_prefix!))) add(r, "因为本商品涉及上面的强制认证/许可");
  }

  // item-level gaps: appliance detected but no rule for this country
  if (category === "appliance") {
    if (!items.size) review.push({ text: "未能识别具体电器类型，无法判断是否属于强制认证清单", reason: "请在标题中写明电器类型（如电饭煲、吹风机）或人工核对清单" });
    for (const it of items) {
      const covered = [...hits.values()].some((h) => h.rule.items.includes(it));
      if (!covered) review.push({ text: `“${ITEM_ZH[it] || it}”在已收录的${COUNTRY_ZH[input.country]}强制认证清单中未找到`, reason: "可能不需强制认证，也可能是知识库未收录或归入其他类别 —— 待人工复核" });
    }
    if (items.has("air_fryer") && input.country !== "TH") review.push({ text: "空气炸锅在该国清单中没有单列，可能归入烤箱/煎炸类", reason: "请向检测机构确认适用类别" });
  }
  if (category === "toy" && features.has("battery")) review.push({ text: "带电池/电动玩具可能还涉及电气安全或电池运输要求", reason: "知识库未收录电动玩具专项条款 —— 待人工复核" });
  if (category === "power" && /无线充/.test(text)) review.push({ text: "无线充电器是否同时需要无线电（NBTC/NTC/MCMC）认证", reason: "知识库未收录无线充电专项条款 —— 待人工复核" });
  if (category === "power" && /数据线|cable/i.test(text) && !features.has("charger")) review.push({ text: "单独销售数据线一般不在充电器认证范围内", reason: "待人工复核" });
  if (category === "cosmetic") {
    const t = findTerms(text, COSMETIC_RISK_TERMS);
    if (t.length) review.push({ text: `出现功效/成分敏感词：${t.join("、")}`, reason: "美白/祛斑/含汞/氢醌/药用等宣称可能被认定为药品或违禁成分，知识库未收录成分清单 —— 待人工复核" });
  }
  if (!category) review.push({ text: "未能识别商品品类（支持：小家电、充电器/移动电源、玩具、化妆品）", reason: "请手动选择品类后重试" });
  if (/电子烟|vape|烟弹|e-cig/i.test(text)) review.push({ text: "电子烟在泰国等国家禁止销售/进口", reason: "超出本工具品类范围 —— 待人工复核" });
  for (const h of hits.values()) if (h.rule.needs_review) review.push({ text: h.rule.title, reason: "知识库中此条为转述或归类不确定 —— 待人工复核" });

  const brandHits = checkBrandWords(text);
  if (img) for (const h of checkBrandWords(img)) if (!brandHits.some((b) => b.brand === h.brand && b.term === h.term)) brandHits.push({ ...h, source: "image" });
  const other_markets: RuleHit[] = kb.rules.filter((r) => (r.country === "ID" || r.country === "VN") && catOk(r)).map((r) => ({ rule: r, reason: `${COUNTRY_ZH[r.country]}提示（仅供参考）` }));

  const all = [...hits.values()];
  const certs = all.filter((h) => h.rule.kind === "cert" || h.rule.kind === "review");
  const report: Report = {
    kb_version: kb.version, input, category, category_source, items: [...items], features: [...features],
    certs, display: all.filter((h) => h.rule.kind === "display"), platform: all.filter((h) => h.rule.kind === "platform"),
    customs: all.filter((h) => h.rule.kind === "customs"), other_markets, review,
    brand: { hits: brandHits, links: ipLinks(input.country) }, risk: { level: "低", reasons: [] }, next_steps: [],
  };
  report.risk = riskLevel(report);
  report.next_steps = nextSteps(report);
  return report;
}

export function riskLevel(r: Report): Report["risk"] {
  const reasons: string[] = [];
  const cf = r.brand.hits.filter((h) => h.type === "counterfeit");
  const br = r.brand.hits.filter((h) => h.type === "brand");
  const mand = r.certs.filter((h) => h.rule.mandatory);
  const drug = r.review.some((x) => x.text.startsWith("出现功效/成分敏感词"));
  if (cf.length) reasons.push(`出现仿冒暗示词：${cf.map((h) => h.term).join("、")}（平台普遍直接下架/封店）`);
  if (br.length) reasons.push(`出现品牌词：${br.map((h) => h.brand).join("、")}（无授权使用他人商标风险高）`);
  if (/电子烟|vape/i.test(r.input.title + (r.input.description || ""))) reasons.push("电子烟类商品");
  if (reasons.length) return { level: "高", reasons };
  if (!r.category) return { level: "待复核", reasons: ["未识别品类"] };
  if (mand.length) reasons.push(`需要 ${mand.length} 项强制认证/通报，未取得即上架属违规`);
  if (drug) reasons.push("化妆品功效/成分宣称敏感");
  if (r.brand.hits.some((h) => h.type === "compat" || h.type === "dupe")) reasons.push("含“兼容/适用于/平替”类品牌描述，需注意措辞");
  if (reasons.length) return { level: "中", reasons };
  return { level: "低", reasons: ["未匹配到强制认证或品牌词（不代表没有风险，请看待复核项）"] };
}

function nextSteps(r: Report): string[] {
  const s: string[] = [];
  if (r.brand.hits.some((h) => h.type === "counterfeit")) s.push("删除“同款/高仿/复刻/1:1”等字样 —— 这些词本身就会触发平台假货判定");
  if (r.brand.hits.some((h) => h.type === "brand")) s.push("去掉他人品牌词，或准备品牌方授权书；在 ASEAN TMview 和目标国商标库检索");
  if (r.certs.some((h) => h.rule.mandatory)) s.push(`上架前先确认已取得：${[...new Set(r.certs.filter((h) => h.rule.mandatory).map((h) => h.rule.cert || h.rule.title))].join("；")}`);
  for (const h of [...r.certs, ...r.display, ...r.customs]) for (const x of h.rule.next_steps) if (!s.includes(x)) s.push(x);
  if (r.review.length) s.push(`逐条核对 ${r.review.length} 个“待人工复核”项`);
  return s.slice(0, 12);
}
