import { containsQuote, normalizeForMatch } from "./normalize";
import { ruleById } from "./kb";
import type { LlmNote } from "./types";

/** Every quote an LLM returns must be an exact (whitespace-insensitive) substring of a KB excerpt of the cited rule. */
export function validateNote(n: { rule_id?: string; quote?: string; explanation?: string }, allowedRuleIds: Set<string>): LlmNote {
  const rule_id = String(n.rule_id || ""); const quote = String(n.quote || "").trim(); const explanation = String(n.explanation || "").slice(0, 600);
  const base = { rule_id, quote, explanation };
  const rule = ruleById[rule_id];
  if (!rule) return { ...base, status: "待人工复核", problem: "引用了知识库中不存在的规则编号" };
  if (!allowedRuleIds.has(rule_id)) return { ...base, status: "待人工复核", problem: "该规则不适用于当前国家/品类" };
  if (!quote) return { ...base, status: "待人工复核", problem: "没有给出原文摘录" };
  const ex = rule.excerpts.find((e) => containsQuote(e.text, quote));
  if (!ex) {
    // also accept a quote that contains a whole excerpt (LLM copied excerpt plus surrounding words is NOT accepted)
    return { ...base, status: "待人工复核", problem: "摘录与知识库原文不一致（可能是模型编造或改写）" };
  }
  if (ex.verification === "paraphrase") return { ...base, status: "待人工复核", problem: "对应条目只有转述，没有可核对的官方原文" };
  if (normalizeForMatch(quote).length < 8) return { ...base, status: "待人工复核", problem: "摘录过短，无法作为依据" };
  return { ...base, status: "verified" };
}
