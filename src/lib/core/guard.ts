import type { EvidenceSource, Feature } from "./types";
import { FEATURE_KEYWORDS, findTerms } from "./detect";
import { ruleById } from "./kb";

/**
 * Deterministic evidence guard for LLM-suggested features.
 * LLMs over-apply radio licences (NBTC / NTC / MCMC) to plain appliances and adapter certs to power banks.
 * A gated feature suggested by the LLM is kept only if the listing text contains explicit evidence.
 * Note: bare "无线"/"wireless" is NOT evidence (无线吸尘器 = cordless, no radio).
 */
export const GATED_EVIDENCE: Partial<Record<Feature, string[]>> = {
  wireless: [...FEATURE_KEYWORDS.wireless, "无线充", "无线充电", "wireless charger", "wireless charging", "magsafe", "磁吸", "qi", "qi2",
    "遥控", "remote control", "rc", "无人机", "drone", "对讲机", "walkie", "耳机蓝牙", "tws", "earbuds", "智能手表", "smart watch", "lora", "433mhz", "rfid"],
  charger: FEATURE_KEYWORDS.charger,
};

/**
 * Dry-cell vs lithium. Toys/appliances powered by AA/AAA/alkaline/carbon-zinc cells must not get the lithium
 * transport (UN38.3 / UN3480) or TIS 2217 cell rules. Any lithium signal wins: 锂/lithium/Li-ion/LiPo/18650/mAh,
 * or a rechargeable built-in battery (USB/Type-C 充电, 可充电, rechargeable) — those are almost always lithium.
 */
const DRY_CELL = /碱性|干电池|碳性电池|碳锌|alkaline|carbon[- ]zinc|zinc[- ]carbon|[57]\s*号\s*电池|\b(?:aa|aaa)\b\s*(?:电池|batter)|(?:\d|两|二|三|四|六)\s*[节颗个粒]\s*(?:aa|aaa)\b|\b(?:aa|aaa)\s*[x×*]\s*\d|\b\d\s*[x×*]\s*(?:aa|aaa)\b|\b(?:aa|aaa)\s*size\b/i;
const LITHIUM = /锂|lithium|li-?ion|li-?po|lipo|li-?polymer|18650|21700|\d\s*mah|充电式|可充电|充电款|充电版|(?:usb|type-?c)\s*充电|rechargeable|充电宝|移动电源|power ?bank/i;
export const LITHIUM_RULES = ["ALL-LIBAT-UN383", "ALL-LIBAT-POWERBANK-UN3480", "ALL-LIBAT-CARRIER", "TH-TISI-BATTERY"];
export function dryCellOnly(text: string): boolean { return DRY_CELL.test(text) && !LITHIUM.test(text); }

export interface GuardResult {
  features: Feature[]; extraRuleIds: string[]; removed: { what: string; reason: string }[];
  /** where the evidence for each kept gated feature came from */
  evidence: { feature: Feature; source: EvidenceSource; term: string }[];
}

/** Returns the evidence for a gated feature: listing text first, then image-derived facts (source='image'). */
export function gatedEvidence(f: Feature, text: string, imageText = ""): { source: EvidenceSource; term: string } | null {
  const kws = GATED_EVIDENCE[f]; if (!kws) return null;
  const t = findTerms(text, kws); if (t.length) return { source: "text", term: t[0] };
  const i = imageText ? findTerms(imageText, kws) : []; if (i.length) return { source: "image", term: i[0] };
  return null;
}

export function guardLlmSuggestions(text: string, features: Feature[], extraRuleIds: string[], imageText = ""): GuardResult {
  const removed: GuardResult["removed"] = []; const evidence: GuardResult["evidence"] = [];
  const ok = (f: Feature) => {
    if (!(f in GATED_EVIDENCE)) return true;
    const e = gatedEvidence(f, text, imageText);
    if (e && !evidence.some((x) => x.feature === f)) evidence.push({ feature: f, ...e });
    return !!e;
  };
  const keptF = features.filter((f) => { const k = ok(f); if (!k) removed.push({ what: `feature:${f}`, reason: "标题/描述/图片中没有明确证据" }); return k; });
  const dry = dryCellOnly(`${text}\n${imageText}`);
  const keptR = extraRuleIds.filter((id) => {
    if (dry && LITHIUM_RULES.includes(id)) { removed.push({ what: `rule:${id}`, reason: "商品使用碱性/干电池（AA/AAA），未提及锂电池" }); return false; }
    const bad = (ruleById[id]?.features || []).find((f) => !ok(f as Feature));
    if (bad) removed.push({ what: `rule:${id}`, reason: `规则需要 ${bad} 特征，但标题/描述/图片中没有明确证据` });
    return !bad;
  });
  return { features: keptF, extraRuleIds: keptR, removed, evidence };
}
