import { buildReport, candidateRules, imageEvidenceText } from "./core/match";
import { validateNote } from "./core/validate";
import type { CheckInput, Report } from "./core/types";
import type { LlmResult } from "./api";

/** Rule report + (optional) AI overrides, re-validated client-side (defense in depth). */
export function composeReport(input: CheckInput, llm: LlmResult | null): Report {
  if (!llm || !llm.ok) return buildReport(input);
  const facts = llm.image_facts || undefined;
  const base = buildReport(input, { category: llm.category ?? undefined, features: llm.features, items: llm.items, extraRuleIds: llm.extra_rule_ids, imageText: imageEvidenceText(facts) });
  const allowed = new Set(candidateRules(input.country, base.category).map((r) => r.id));
  const notes = llm.notes.map((n) => validateNote(n, allowed));
  return { ...base, image_facts: facts, llm: { model: llm.model, summary: llm.summary, notes, extra_rule_ids: llm.extra_rule_ids, latency_ms: llm.latency_ms, dropped: llm.dropped } };
}
