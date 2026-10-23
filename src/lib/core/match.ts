import { kb } from "./kb";
import { detectCategory, detectFeatures, detectItems, findTerms, COSMETIC_RISK_TERMS, ITEM_ZH } from "./detect";
import { checkBrandWords, ipLinks } from "./brands";
import type { Category, CheckInput, Conclusion, ConclusionStep, Feature, Report, ReviewItem, Rule, RuleHit } from "./types";
import { certBrief, maybeCerts, mustCerts, wirelessKinds } from "./plain";
import { LITHIUM_RULES, dryCellOnly } from "./guard";

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
    ...((["tiktok", "shopee", "lazada"] as const).includes(i.platform as never) ? { platform: i.platform } : {}),
  };
}

export const AI_JUDGED = "AI 根据商品信息判断";
const FEATURE_REASON: Record<Feature, string> = { wireless: "识别到无线通信功能", battery: "识别到内置/配套电池", charger: "识别到子类：充电器/适配器", powerbank: "识别到子类：移动电源（充电宝）", kids: "识别到儿童适用" };
/** Who to verify country-level open questions with. */
export const VERIFY_WITH = { TH: "TISI（สมอ.）或泰国认可检测机构", PH: "DTI-BPS 或菲律宾认可检测机构", MY: "Suruhanjaya Tenaga 或 SIRIM QAS" } as const;

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
  const featTerm = (f: Feature) => fd.find((x) => x.feature === f)?.term;
  const why = (t?: string) => (t ? `关键词：${t}` : AI_JUDGED);
  const itemsT = detectItems(text);
  const itemsD = [...itemsT, ...(img ? detectItems(img).filter((x) => !itemsT.some((y) => y.item === x.item)).map((x) => ({ ...x, term: `图片：${x.term}` })) : [])];
  const items = new Set<string>([...itemsD.map((x) => x.item), ...(ov.items || [])]);
  if ((category === "power" && /插线板|延长线|排插|extension/i.test(text)) || (category === "appliance" && /插线板|延长线|排插|extension cord|extension lead|power strip/i.test(text))) items.add("extension_cord");
  if (category === "power" && !features.has("charger") && !features.has("powerbank")) {
    if (/充电宝|移动电源|power ?bank/i.test(`${text}\n${img}`)) features.add("powerbank"); else features.add("charger");
  }

  if (features.has("powerbank")) features.add("battery"); // a power bank is a lithium battery
  // AA/AAA/alkaline-powered goods: lithium transport/cell rules do not apply unless lithium is mentioned
  const dryCell = features.has("battery") && !features.has("powerbank") && dryCellOnly(`${text}\n${img}`);
  const lithiumOff = (r: Rule) => dryCell && LITHIUM_RULES.includes(r.id);

  const review: ReviewItem[] = [];
  const hits = new Map<string, RuleHit>();
  const add = (r: Rule, reason: string) => { if (!hits.has(r.id)) hits.set(r.id, { rule: r, reason }); };
  const catOk = (r: Rule) => r.categories.includes("*") || (category != null && r.categories.includes(category));

  for (const r of kb.rules) {
    if (r.country !== input.country && r.country !== "ALL") continue;
    if (!catOk(r) || r.requires_cert_prefix) continue;
    if (r.platforms.length && input.platform && !r.platforms.includes(input.platform)) continue;
    if (lithiumOff(r)) continue;
    if (r.items.length) {
      const it = r.items.find((i) => items.has(i)); if (!it) continue;
      add(r, `识别到品类“${ITEM_ZH[it] || it}”（${why(itemsD.find((x) => x.item === it)?.term)}）`); continue;
    }
    if (r.features.length) {
      const f = r.features.find((x) => features.has(x)); if (!f) continue;
      add(r, `${FEATURE_REASON[f]}（${why(featTerm(f))}）`); continue;
    }
    if (r.kind === "platform") { add(r, input.platform ? `所选平台：${PLATFORM_ZH[input.platform]}` : `适用平台：${r.platforms.map((p) => PLATFORM_ZH[p]).join(" / ") || "全部"}`); continue; }
    add(r, category ? `${COUNTRY_ZH[input.country]} · ${CATEGORY_ZH[category]}` : COUNTRY_ZH[input.country]);
  }
  for (const id of ov.extraRuleIds || []) {
    const r = kb.rules.find((x) => x.id === id);
    if (r && (r.country === input.country || r.country === "ALL") && catOk(r) && !r.requires_cert_prefix && !hits.has(r.id) && !lithiumOff(r))
      hits.set(r.id, { rule: r, reason: `${AI_JUDGED}（规则本身来自知识库）`, tier: "maybe", tier_reason: "仅 AI 判断适用，标题和图片中没有直接证据" });
  }
  // classification-uncertain mandatory certs are 可能需要 (not counted in risk); wireless cards say which radio tech was evidenced
  const wl = wirelessKinds(`${text}\n${img}`);
  for (const h of hits.values()) {
    if (h.rule.kind === "cert" && h.rule.mandatory && h.rule.needs_review && !h.tier) { h.tier = "maybe"; h.tier_reason = "知识库中此条归类或适用范围待核实"; }
    if (h.rule.features.includes("wireless")) {
      const t = featTerm("wireless")?.replace(/^图片：/, "");
      h.title = `${h.rule.title}（${wl.length ? wl.join(" / ") : t ? t : `无线电功能 · ${AI_JUDGED}`}）`;
    }
  }
  const certIds = [...hits.values()].filter((h) => h.rule.kind === "cert").map((h) => h.rule.id);
  for (const r of kb.rules) if (r.requires_cert_prefix && r.country === input.country && catOk(r)) {
    if (certIds.some((id) => id.startsWith(r.requires_cert_prefix!))) add(r, "因为本商品涉及上面的强制认证/许可");
  }

  // item-level gaps: appliance detected but no rule for this country
  if (category === "appliance") {
    if (!items.size) review.push({ text: "未能识别具体电器类型，无法判断是否属于强制认证清单", reason: "请在标题中写明电器类型（如电饭煲、吹风机）后重新检查", verify_with: VERIFY_WITH[input.country] });
    for (const it of items) {
      const covered = [...hits.values()].some((h) => h.rule.items.includes(it));
      if (!covered) review.push({ text: `“${ITEM_ZH[it] || it}”在已收录的${COUNTRY_ZH[input.country]}强制认证清单中未找到`, reason: "可能不需强制认证，也可能是知识库未收录或归入其他类别", verify_with: VERIFY_WITH[input.country] });
    }
    if (items.has("air_fryer") && input.country !== "TH") review.push({ text: "空气炸锅在该国清单中没有单列，可能归入烤箱/煎炸类", reason: "可能归入其他类别", verify_with: VERIFY_WITH[input.country] });
  }
  const att = (...ids: string[]) => ids.find((id) => hits.has(id));
  const TOY = { TH: "TH-TISI-TOY", PH: "PH-FDA-TOY", MY: "MY-KPDN-TOY" }, RADIO = { TH: "TH-NBTC-RADIO", PH: "PH-NTC-WIRELESS", MY: "MY-MCMC-COMM" }, COSM = { TH: "TH-FDA-COSM", PH: "PH-FDA-COSM", MY: "MY-NPRA-COSM" };
  if (category === "toy" && features.has("battery")) review.push({ text: "电动玩具可能还涉及玩具标准中的电气安全条款", reason: "知识库未收录电动玩具专项条款", verify_with: input.country === "PH" ? "FDA Philippines（CDRRHR）" : input.country === "MY" ? "KPDN" : "TISI（สมอ.）", rule_id: att(TOY[input.country]) });
  if (dryCell && category !== "cosmetic") review.push({ text: "识别为碱性/干电池（AA、AAA 等）供电，未套用锂电池运输与电芯认证规则", reason: "如商品实际内置或配套锂电池，请在商品信息中注明后重新检查" });
  if (features.has("battery") && !dryCell && input.country !== "TH" && category !== "cosmetic") review.push({ text: `知识库未收录${COUNTRY_ZH[input.country]}针对锂电池本身的单独强制认证`, reason: "电池是否另需本国认证尚未核实", verify_with: VERIFY_WITH[input.country], rule_id: att("ALL-LIBAT-UN383") });
  if (category === "power" && /无线充/.test(text)) review.push({ text: "无线充电功能是否同时需要无线电认证", reason: "知识库未收录无线充电专项条款", verify_with: input.country === "TH" ? "NBTC" : input.country === "PH" ? "NTC" : "MCMC 或 SIRIM QAS", rule_id: att(RADIO[input.country], "TH-TISI-POWERBANK", "TH-TISI-ADAPTER", "MY-ST-ADAPTER") });
  if (category === "power" && /数据线|cable/i.test(text) && !features.has("charger")) review.push({ text: "单独销售数据线一般不在充电器认证范围内", reason: "知识库未收录数据线专项条款", verify_with: VERIFY_WITH[input.country] });
  if (category === "cosmetic") {
    const t = findTerms(text, COSMETIC_RISK_TERMS);
    if (t.length) review.push({ text: `出现功效/成分敏感词：${t.join("、")}`, reason: "美白/祛斑/含汞/氢醌/药用等宣称可能被认定为药品或违禁成分，知识库未收录成分清单", verify_with: input.country === "TH" ? "泰国 FDA（อย.）" : input.country === "PH" ? "FDA Philippines" : "NPRA", rule_id: att(COSM[input.country]) });
  }
  if (!category) review.push({ text: "未能识别商品品类（支持：小家电、充电器/移动电源、玩具、化妆品）", reason: "请手动选择品类后重试" });
  if (/电子烟|vape|烟弹|e-cig/i.test(text)) review.push({ text: "电子烟在泰国等国家禁止销售/进口", reason: "超出本工具品类范围", verify_with: "目标国海关及平台卖家中心" });
  for (const h of hits.values()) if (h.rule.needs_review) review.push({ text: h.title || h.rule.title, reason: h.rule.mandatory ? "可能需要：适用范围或归类尚不确定" : "知识库中此条为转述或归类不确定", verify_with: h.rule.verify_with || h.rule.authority, rule_id: h.rule.id });

  const brandHits = checkBrandWords(text);
  if (img) for (const h of checkBrandWords(img)) if (!brandHits.some((b) => b.brand === h.brand && b.term === h.term)) brandHits.push({ ...h, source: "image" });
  const other_markets: RuleHit[] = kb.rules.filter((r) => (r.country === "ID" || r.country === "VN") && catOk(r)).map((r) => ({ rule: r, reason: `${COUNTRY_ZH[r.country]}提示（仅供参考）` }));

  const all = [...hits.values()];
  const certs = all.filter((h) => h.rule.kind === "cert" || h.rule.kind === "review");
  const report: Report = {
    kb_version: kb.version, input, category, category_source, items: [...items], features: [...features],
    certs, display: all.filter((h) => h.rule.kind === "display"), platform: all.filter((h) => h.rule.kind === "platform"),
    customs: all.filter((h) => h.rule.kind === "customs"), other_markets, review,
    brand: { hits: brandHits, links: ipLinks(input.country) }, risk: { level: "低", reasons: [], basis: "" }, next_steps: [], conclusion: { verdict: "unknown", headline: "", must: [], maybe: [], steps: [], more: 0 },
  };
  report.risk = riskLevel(report);
  report.next_steps = nextSteps(report);
  report.conclusion = conclusion(report);
  return report;
}

/** Mandatory certs/licences the seller must hold before listing (deduped by cert name). */
/** Only 必须 certs (tier must) — 可能需要 ones are excluded from counts and risk. */
export function mandatoryCerts(r: Pick<Report, "certs">): RuleHit[] { return mustCerts(r); }
const PROHIBITED = /电子烟|vape|烟弹|e-cig/i;

/**
 * Risk is tied to evidence, with a one-line 判定依据:
 *  高 = any prohibited/counterfeit signal, other-brand words, or ≥2 mandatory certs
 *  中 = exactly 1 mandatory cert, sensitive cosmetic claims, or compat/dupe wording
 *  低 = none of the above;  待复核 = category unknown
 */
export function riskLevel(r: Report): Report["risk"] {
  const reasons: string[] = [];
  const cf = r.brand.hits.filter((h) => h.type === "counterfeit");
  const br = r.brand.hits.filter((h) => h.type === "brand");
  const mand = mandatoryCerts(r);
  const maybe = maybeCerts(r).length;
  const drug = r.review.some((x) => x.text.startsWith("出现功效/成分敏感词"));
  const prohibited = PROHIBITED.test(r.input.title + (r.input.description || ""));
  const mandTxt = `必须的认证/许可 ${mand.length} 项`;
  const maybeTxt = maybe ? `；另有 ${maybe} 项可能需要，未计入风险等级` : "";
  if (prohibited) reasons.push("电子烟类商品：在泰国等国家禁止销售/进口");
  if (cf.length) reasons.push(`出现仿冒暗示词：${cf.map((h) => h.term).join("、")}（平台普遍直接下架/封店）`);
  if (br.length) reasons.push(`出现品牌词：${br.map((h) => h.brand).join("、")}（无授权使用他人商标风险高）`);
  if (!r.category && !reasons.length) return { level: "待复核", reasons: ["未识别品类"], basis: "判定依据：未能识别商品品类，无法匹配认证规则" };
  if (mand.length) reasons.push(`须先办齐 ${mand.length} 项必须的认证/许可才能上架`);
  if (maybe) reasons.push(`另有 ${maybe} 项认证可能需要，需向主管机构核实`);
  if (drug) reasons.push("化妆品功效/成分宣称敏感");
  if (r.brand.hits.some((h) => h.type === "compat" || h.type === "dupe")) reasons.push("含“兼容/适用于/平替”类品牌描述，需注意措辞");
  const hard = [prohibited && "禁售品类", cf.length && "仿冒暗示词", br.length && "他人品牌词"].filter(Boolean) as string[];
  if (hard.length) return { level: "高", reasons, basis: `判定依据：出现${hard.join("、")}（任一即判为高风险）；${mandTxt}${maybeTxt}` };
  if (mand.length >= 2) return { level: "高", reasons, basis: `判定依据：${mandTxt}（≥2 项判为高风险）${maybeTxt}` };
  if (mand.length === 1 || drug || reasons.length) {
    const why = [mand.length === 1 && "必须的认证/许可 1 项", drug && "功效/成分敏感宣称", r.brand.hits.some((h) => h.type === "compat" || h.type === "dupe") && "兼容/平替类措辞"].filter(Boolean).join("、");
    return { level: "中", reasons, basis: `判定依据：${why}（1 项必须认证或存在敏感措辞判为中风险）${maybeTxt}` };
  }
  return { level: "低", reasons: ["未匹配到必须的认证或品牌词（不代表没有风险，请看待复核项）"], basis: `判定依据：${mandTxt}，未命中品牌词或禁售品类${maybeTxt}` };
}

/** Deterministic plain-language conclusion: verdict → 必须 vs 可能需要 → 先做 3 步. */
export function conclusion(r: Report): Conclusion {
  const where = r.input.platform ? `${COUNTRY_ZH[r.input.country]} ${PLATFORM_ZH[r.input.platform]} ` : `${COUNTRY_ZH[r.input.country]}`;
  const must = mandatoryCerts(r).map(certBrief), maybe = maybeCerts(r).map(certBrief);
  const cf = r.brand.hits.filter((h) => h.type === "counterfeit"); const br = r.brand.hits.filter((h) => h.type === "brand");
  const prohibited = PROHIBITED.test(r.input.title + (r.input.description || ""));
  const brTail = br.length ? `；标题中的品牌词“${br[0].term}”需先删除或取得授权` : "";
  const maybeTail = maybe.length ? `；另有 ${maybe.length} 项可能需要，建议同步核实` : "";
  let verdict: Conclusion["verdict"], headline: string;
  if (prohibited) { verdict = "prohibited"; headline = `禁止销售：电子烟类商品在${COUNTRY_ZH[r.input.country]}等国家禁止销售或进口，请勿上架。`; }
  else if (!r.category) { verdict = "unknown"; headline = "暂时无法判断：没有识别出商品品类，请手动选择品类后重新检查。"; }
  else if (cf.length) { verdict = "blocked"; headline = `按当前写法不能上架：标题含“${cf[0].term}”等仿冒暗示词，平台通常直接下架。改写后${must.length ? `办齐 ${must.length} 项必须的认证即可上架` : "可重新检查"}。`; }
  else if (must.length) { verdict = "certs_first"; headline = `办齐 ${must.length} 项必须的认证后，可以在${where}上架${maybeTail}${brTail}。`; }
  else if (maybe.length) { verdict = "verify_first"; headline = `目前没有确定必须办理的认证，但有 ${maybe.length} 项可能需要；核实后再在${where}上架${brTail}。`; }
  else { verdict = "ok"; headline = `未发现必须先办的强制认证，满足标签与平台要求后可以在${where}上架${brTail}。`; }

  const steps: ConclusionStep[] = [];
  if (prohibited) {
    steps.push({ kind: "stop", text: "不要上架该商品；已上架的请立即下架" });
    steps.push({ kind: "verify", text: "如计划销往其他国家，先向当地海关核实是否允许进口" });
    return { verdict, headline, must, maybe, steps, more: 0 };
  }
  if (cf.length) steps.push({ kind: "fix", text: `删除“${cf.map((h) => h.term).join("、")}”等字样，改写标题后重新检查` });
  if (br.length) steps.push({ kind: "fix", text: `去掉品牌词“${br.map((h) => h.term).join("、")}”，或先取得品牌方授权书` });
  for (const c of must) steps.push({ kind: "cert", text: `办理${c.plain}（${c.abbr}）`, cert: c });
  for (const c of maybe) steps.push({ kind: "verify", text: `核实是否需要${c.plain}（${c.abbr}）`, cert: c });
  const loose = r.review.filter((x) => !x.rule_id);
  if (!must.length && !maybe.length && loose.length) steps.push({ kind: "verify", text: `核实：${loose[0].text}${loose[0].verify_with ? `（建议向 ${loose[0].verify_with} 咨询）` : ""}` });
  if (r.display.length) steps.push({ kind: "list", text: `按 ${r.display.length} 项标签/展示要求准备 listing 图片和描述` });
  if (!steps.length) steps.push({ kind: "list", text: "上架前按下方清单核对标签和平台类目要求" });
  return { verdict, headline, must, maybe, steps: steps.slice(0, 3), more: steps.filter((x, i) => i >= 3 && (x.kind === "cert" || x.kind === "verify")).length };
}

/** History reports saved before 2026.10.23-3 stored conclusion as string[] — recompute. */
export function conclusionOf(r: Report): Conclusion {
  const c = r.conclusion as unknown;
  return c && typeof c === "object" && !Array.isArray(c) && "steps" in c ? (c as Conclusion) : conclusion(r);
}

function nextSteps(r: Report): string[] {
  const s: string[] = [];
  if (r.brand.hits.some((h) => h.type === "counterfeit")) s.push("删除“同款/高仿/复刻/1:1”等字样 —— 这些词本身就会触发平台假货判定");
  if (r.brand.hits.some((h) => h.type === "brand")) s.push("去掉他人品牌词，或准备品牌方授权书；在 ASEAN TMview 和目标国商标库检索");
  const must = mandatoryCerts(r), maybe = maybeCerts(r);
  if (must.length) s.push(`上架前先确认已取得：${must.map((h) => h.rule.cert || h.rule.title).join("；")}`);
  if (maybe.length) s.push(`核实是否需要：${maybe.map((h) => `${h.rule.cert || h.rule.title}（向 ${h.rule.verify_with || h.rule.authority} 确认）`).join("；")}`);
  for (const h of [...r.certs, ...r.display, ...r.customs]) for (const x of h.rule.next_steps) if (!s.includes(x)) s.push(x);
  if (/蓝牙|bluetooth/i.test(`${r.input.title}\n${r.input.description || ""}`) && r.certs.some((h) => h.rule.id === "PH-NTC-WIRELESS")) s.push("蓝牙属短距无线设备（SRD），请向 NTC 确认蓝牙产品的现行认可程序");
  if (r.review.length) s.push(`逐条核对 ${r.review.length} 个待核实项（多数已并入对应认证卡片）`);
  return s.slice(0, 12);
}
