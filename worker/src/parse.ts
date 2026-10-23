import { ITEM_KEYWORDS } from "../../src/lib/core/detect";
import { validateNote } from "../../src/lib/core/validate";
import { ruleById } from "../../src/lib/core/kb";
import { candidateRules } from "../../src/lib/core/match";
import { detectCategory } from "../../src/lib/core/detect";
import type { Category, CheckInput, Feature, LlmNote } from "../../src/lib/core/types";

/** tolerant JSON extraction: strips <think>, code fences, leading prose */
export function extractJson(s: string): any | null {
  let t = s.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch { try { return JSON.parse(t.replace(/,\s*([}\]])/g, "$1")); } catch { return null; } }
}

const CATS = ["appliance", "power", "toy", "cosmetic"]; const FEATS = ["wireless", "battery", "charger", "powerbank", "kids"];

export function postProcess(input: CheckInput, raw: any) {
  let dropped = 0;
  let category: Category | null = CATS.includes(raw?.category) ? raw.category : null;
  if (input.category && input.category !== "auto") category = input.category;
  if (!category) category = detectCategory(`${input.title}\n${input.description}`).category;
  const features = (Array.isArray(raw?.features) ? raw.features : []).filter((f: string) => FEATS.includes(f)) as Feature[];
  const items = (Array.isArray(raw?.items) ? raw.items : []).filter((i: string) => i in ITEM_KEYWORDS);
  const allowed = new Set(candidateRules(input.country, category).map((r) => r.id));
  const extra: string[] = [];
  for (const id of Array.isArray(raw?.extra_rule_ids) ? raw.extra_rule_ids : []) { if (allowed.has(id)) extra.push(id); else dropped++; }
  const notes: LlmNote[] = [];
  for (const n of (Array.isArray(raw?.notes) ? raw.notes : []).slice(0, 8)) {
    if (!n || !ruleById[n.rule_id]) { dropped++; continue; } // non-existent rule ids are hallucinations: drop
    notes.push(validateNote(n, allowed));
  }
  const next_steps = (Array.isArray(raw?.next_steps) ? raw.next_steps : []).map((x: unknown) => String(x).slice(0, 200)).slice(0, 8);
  const summary = String(raw?.summary || "").slice(0, 300);
  return { category, features, items, extra_rule_ids: [...new Set(extra)], notes, next_steps, summary, dropped };
}
