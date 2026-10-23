import type { Country, Report } from "./types";
import { COUNTRY_ZH, conclusionOf } from "./match";

/**
 * Plain three-way verdict shown on the result card. Everything else (risk level, evidence, citations,
 * 可能需要 / 待复核 items) lives under 查看详细依据.
 *  prohibited                → no    不能销售
 *  certs_first (≥1 必须证书) → certs 办证后可上架; verify_first (only 可能需要) → ok with a 核实 sentence
 *  ok                        → ok    可以上架
 *  unknown (no category)     → unknown 暂无法判断 — the only case where none of the three can be stated honestly
 */
export type Verdict = "ok" | "certs" | "no" | "unknown";
export const VERDICT_LABEL: Record<Verdict, string> = { ok: "可以上架", certs: "办证后可上架", no: "不能销售", unknown: "暂无法判断" };

export interface CertLine { name: string; where: string }
export interface CountrySummary { country: Country; verdict: Verdict; label: string; sentence: string; certs: CertLine[]; steps: string[] }

export function summarize(r: Report): CountrySummary {
  const c = conclusionOf(r);
  const zh = COUNTRY_ZH[r.input.country];
  const cf = r.brand.hits.filter((h) => h.type === "counterfeit");
  const br = r.brand.hits.filter((h) => h.type === "brand");
  const certs: CertLine[] = c.must.map((b) => ({
    name: b.abbr && b.abbr !== b.plain ? `${b.plain}（${b.abbr}）` : b.plain,
    where: `${b.issuer} · ${b.applicant}`,
  }));
  let verdict: Verdict; let sentence: string;
  if (c.verdict === "prohibited") { verdict = "no"; sentence = `此类商品在${zh}禁止销售或进口，请勿上架。`; }
  else if (c.verdict === "unknown") { verdict = "unknown"; sentence = "没有识别出商品品类，请在商品信息中写明具体是什么商品后再查。"; }
  else if (c.must.length) { verdict = "certs"; sentence = `需先办好 ${c.must.length} 项证书，才能在${zh}合法上架。`; }
  else { verdict = "ok"; sentence = c.maybe.length ? `未发现必须先办的证书；另有 ${c.maybe.length} 项可能需要，建议上架前核实。` : `未发现必须先办的证书，按要求准备标签和商品图后即可在${zh}上架。`; }
  if (verdict !== "no" && cf.length) sentence += `标题中的“${cf[0].term}”会被平台判为仿冒，需先删除。`;
  else if (verdict !== "no" && br.length) sentence += `标题中的品牌词“${br[0].term}”需删除或取得授权。`;

  const steps: string[] = [];
  const push = (s?: string) => { if (s && !steps.includes(s)) steps.push(s); };
  if (verdict === "no") { push("不要上架该商品；已上架的请立即下架"); push("如计划销往其他国家，先向当地海关核实是否允许进口"); }
  else {
    if (cf.length) push(`删除“${cf.map((h) => h.term).join("、")}”等字样后重新检查`);
    if (br.length) push(`去掉品牌词“${br.map((h) => h.term).join("、")}”，或先取得品牌方授权书`);
    // practical next step from the KB for each required cert (first one per cert)
    for (const b of c.must) { const h = r.certs.find((x) => x.rule.id === b.rule_id); push(h?.rule.next_steps.find((s) => !/待人工复核|第三方/.test(s))); }
    if (!c.must.length && c.maybe.length) push(`向 ${c.maybe[0].verify_with || c.maybe[0].issuer} 核实是否需要${c.maybe[0].plain}`);
    if (r.display.length) push("在主图或详情图中展示认证标志、编号和当地语言标签");
    if (verdict === "unknown") push("补充商品类型、材质、供电方式等信息后再查一次");
    if (!steps.length) push("上架前核对平台类目要求和商品标签");
  }
  return { country: r.input.country, verdict, label: VERDICT_LABEL[verdict], sentence, certs, steps: steps.slice(0, 3) };
}

/** One free-text 商品信息 box → title (first line, ≤200 chars) + description (the rest). */
export function splitInfo(info: string): { title: string; description: string } {
  const t = String(info || "").replace(/\r\n?/g, "\n").trim();
  const nl = t.indexOf("\n");
  let title = nl < 0 ? t : t.slice(0, nl).trim(); let rest = nl < 0 ? "" : t.slice(nl + 1).trim();
  if (title.length > 200) { rest = `${title.slice(200)}\n${rest}`.trim(); title = title.slice(0, 200); }
  return { title, description: rest.slice(0, 2000) };
}
