import type { CertBrief, Report, RuleHit } from "./types";

/**
 * Plain-language name / abbreviation / who-applies for each certificate rule.
 * Applicant wording stays generic ("通常由…") unless the KB rule itself states it; durations are
 * never filled in here — only a KB `lead_time` with a source may be shown.
 */
const DEFAULT_APPLICANT = "通常由当地进口商或认证代理申请";
type P = { plain: string; abbr: string | ((h: RuleHit) => string); issuer: string; applicant?: string };
const TISI_NO = (h: RuleHit) => { const m = `${h.rule.cert || ""} ${h.rule.title}`.match(/มอก\.\s*\d+(?:[-–]\d+)?(?:\s*Part\s*\d+(?:\(\d+\))?)?/); return m ? `TISI ${m[0]}` : "TISI"; };
const MAP: [RegExp, P][] = [
  [/^TH-TISI-BATTERY$/, { plain: "泰国电池强制认证", abbr: TISI_NO, issuer: "TISI（สมอ.）" }],
  [/^TH-TISI-/, { plain: "泰国工业产品强制认证", abbr: TISI_NO, issuer: "TISI（สมอ.）" }],
  [/^TH-FDA-COSM$/, { plain: "泰国化妆品备案", abbr: "Thai FDA จดแจ้ง", issuer: "泰国 FDA（อย.）" }],
  [/^TH-NBTC-/, { plain: "泰国无线电设备认证", abbr: "NBTC", issuer: "NBTC（กสทช.）" }],
  [/^PH-BPS-/, { plain: "菲律宾产品安全认证", abbr: "PS / ICC", issuer: "DTI-BPS" }],
  [/^PH-FDA-COSM$/, { plain: "菲律宾化妆品备案", abbr: "FDA CPN", issuer: "FDA Philippines", applicant: "须由持有 LTO 的当地公司申请" }],
  [/^PH-FDA-TOY$/, { plain: "菲律宾玩具备案", abbr: "FDA TCCA", issuer: "FDA Philippines", applicant: "须由持有 LTO 的当地公司申请" }],
  [/^PH-NTC-/, { plain: "菲律宾无线电设备型式认可", abbr: "NTC", issuer: "NTC" }],
  [/^MY-ST-/, { plain: "马来西亚电器安全认证", abbr: "ST CoA", issuer: "Suruhanjaya Tenaga" }],
  [/^MY-MCMC-/, { plain: "马来西亚通信设备认证", abbr: "MCMC / SIRIM", issuer: "MCMC（由 SIRIM QAS 办理）" }],
  [/^MY-KPDN-TOY$/, { plain: "马来西亚玩具合格标志", abbr: "KPDN MC", issuer: "KPDN" }],
  [/^MY-NPRA-COSM$/, { plain: "马来西亚化妆品备案", abbr: "NPRA", issuer: "NPRA" }],
  [/^ALL-LIBAT-UN383$/, { plain: "锂电池运输安全测试", abbr: "UN38.3", issuer: "无政府发证，由检测实验室出具报告",
    applicant: "由电池或整机制造商委托实验室测试；向供应商索取测试报告和测试摘要（IATA 要求制造商及后续分销商提供）" }],
];

export function certBrief(h: RuleHit): CertBrief {
  const p = MAP.find(([re]) => re.test(h.rule.id))?.[1];
  const r = h.rule;
  return {
    rule_id: r.id,
    plain: p?.plain || r.title,
    abbr: p ? (typeof p.abbr === "function" ? p.abbr(h) : p.abbr) : r.cert || "",
    issuer: p?.issuer || r.authority,
    applicant: p?.applicant || DEFAULT_APPLICANT,
    ...(r.lead_time ? { lead_time: r.lead_time } : {}),
    ...(tierOf(h) === "maybe" ? { verify_with: r.verify_with || r.authority, maybe_reason: h.tier_reason || "适用范围或归类尚不确定" } : {}),
  };
}

/** must = 未取得即上架属违规; maybe = applicability uncertain (KB 归类待核实, or only AI judged it applies). */
export function tierOf(h: RuleHit): "must" | "maybe" {
  return h.tier ?? (h.rule.needs_review ? "maybe" : "must");
}
export const isCertHit = (h: RuleHit) => h.rule.kind === "cert" && h.rule.mandatory;
const dedupe = (xs: RuleHit[]) => { const seen = new Set<string>(); return xs.filter((h) => { const k = h.rule.cert || h.rule.title; if (seen.has(k)) return false; seen.add(k); return true; }); };
/** country-specific certs before transport (ALL-*) ones */
const order = (xs: RuleHit[]) => [...xs].sort((a, b) => +(a.rule.country === "ALL") - +(b.rule.country === "ALL"));
export const mustCerts = (r: Pick<Report, "certs">) => order(dedupe(r.certs.filter((h) => isCertHit(h) && tierOf(h) === "must")));
export const maybeCerts = (r: Pick<Report, "certs">) => order(dedupe(r.certs.filter((h) => isCertHit(h) && tierOf(h) === "maybe")));

/** Wireless technology actually evidenced in text/image, used to title the radio-cert cards. */
const WL: [RegExp, string][] = [
  [/蓝牙|bluetooth|\bBT\s?5/i, "蓝牙"],
  [/wi-?fi|wlan|无线网|智能联网/i, "WiFi"],
  [/2\.4\s?g|5\.8\s?g|(?<!红外)遥控|rc car|无人机|drone/i, "2.4G 遥控"],
  [/无线充|磁吸充|magsafe|qi\s?无线|wireless charg/i, "无线充电"],
  [/\bnfc\b/i, "NFC"],
  [/zigbee/i, "Zigbee"],
];
export function wirelessKinds(text: string): string[] {
  return WL.filter(([re]) => re.test(text)).map(([, k]) => k);
}
