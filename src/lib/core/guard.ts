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
  const keptR = extraRuleIds.filter((id) => {
    const bad = (ruleById[id]?.features || []).find((f) => !ok(f as Feature));
    if (bad) removed.push({ what: `rule:${id}`, reason: `规则需要 ${bad} 特征，但标题/描述/图片中没有明确证据` });
    return !bad;
  });
  return { features: keptF, extraRuleIds: keptR, removed, evidence };
}
