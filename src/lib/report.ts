import { buildReport, candidateRules, imageEvidenceText } from "./core/match";
import { validateNote } from "./core/validate";
import { summarize, type CountrySummary } from "./core/verdict";
import type { Country, Report } from "./core/types";
import type { CheckResponse } from "./api";

export interface CountryView { country: Country; report: Report; summary: CountrySummary; aiOk: boolean; aiMessage?: string }

/** Per-country rule report + AI overrides, re-validated client-side (defense in depth). A failed country falls back to rules only. */
export function composeCountries(res: CheckResponse): CountryView[] {
  const facts = res.image_facts || undefined;
  const imageText = imageEvidenceText(facts);
  return res.countries.map((country) => {
    const input = { title: res.input.title, description: res.input.description, country, category: "auto" as const };
    const o = res.results[country];
    let report: Report;
    if (o && o.ok) {
      const base = buildReport(input, { category: o.category ?? undefined, features: o.features, items: o.items, extraRuleIds: o.extra_rule_ids, imageText });
      const allowed = new Set(candidateRules(country, base.category).map((r) => r.id));
      report = { ...base, image_facts: facts, llm: { model: res.model, summary: o.summary, notes: o.notes.map((n) => validateNote(n, allowed)), extra_rule_ids: o.extra_rule_ids, latency_ms: o.latency_ms, dropped: o.dropped } };
    } else report = { ...buildReport(input, { imageText }), image_facts: facts };
    return { country, report, summary: summarize(report), aiOk: !!o?.ok, aiMessage: o && !o.ok ? o.message : undefined };
  });
}
