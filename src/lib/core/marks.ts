/**
 * Certification marks → issuing country/scheme. Country attribution comes from this table (aligned with the KB
 * authorities), never from the vision model's own description — models mislabel e.g. ICC as Japanese/Korean.
 */
export type MarkCountry = "TH" | "PH" | "MY" | "ID" | "EU" | "US" | "UK" | "CN" | "JP" | "KR" | "INTL";
export const MARK_INFO: Record<string, { country: MarkCountry; label: string }> = {
  TISI: { country: "TH", label: "泰国 TISI（มอก.）" },
  NBTC: { country: "TH", label: "泰国 NBTC 无线认证" },
  ICC: { country: "PH", label: "菲律宾 ICC / PS" },
  PS: { country: "PH", label: "菲律宾 PS 标志" },
  NTC: { country: "PH", label: "菲律宾 NTC 无线认证" },
  SIRIM: { country: "MY", label: "马来西亚 SIRIM / ST-SIRIM" },
  ST: { country: "MY", label: "马来西亚能源委员会 ST" },
  MCMC: { country: "MY", label: "马来西亚 MCMC 通信认证" },
  SNI: { country: "ID", label: "印尼 SNI" },
  CE: { country: "EU", label: "欧盟 CE" },
  WEEE: { country: "EU", label: "欧盟 WEEE 回收标志" },
  RoHS: { country: "EU", label: "RoHS 有害物质限制" },
  UKCA: { country: "UK", label: "英国 UKCA" },
  FCC: { country: "US", label: "美国 FCC" },
  UL: { country: "US", label: "美国 UL" },
  CCC: { country: "CN", label: "中国 CCC" },
  PSE: { country: "JP", label: "日本 PSE" },
  KC: { country: "KR", label: "韩国 KC" },
  FDA: { country: "INTL", label: "FDA（国别需看标志文字）" },
  Halal: { country: "INTL", label: "清真认证" },
  Recycle: { country: "INTL", label: "回收标志" },
};
const CN: Record<MarkCountry, string> = { TH: "泰国", PH: "菲律宾", MY: "马来西亚", ID: "印尼", EU: "欧盟", US: "美国", UK: "英国", CN: "中国", JP: "日本", KR: "韩国", INTL: "" };
export const markCountryZh = (m: string) => CN[MARK_INFO[m]?.country ?? "INTL"];
/** e.g. "ICC（菲律宾）" — for prompts and plain text. */
export const markWithCountry = (m: string) => (markCountryZh(m) ? `${m}（${markCountryZh(m)}）` : m);
/** Marks that belong to a different SEA target market than `country` (useful warning: a TH mark does not cover MY). */
export function foreignSeaMarks(marks: string[], country: string): string[] {
  return marks.filter((m) => { const c = MARK_INFO[m]?.country; return (c === "TH" || c === "PH" || c === "MY") && c !== country; });
}
