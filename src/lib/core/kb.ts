import raw from "../../../kb/rules.json";
import type { KB, Rule } from "./types";
export const kb = raw as unknown as KB;
export const ruleById: Record<string, Rule> = Object.fromEntries(kb.rules.map((r) => [r.id, r]));
