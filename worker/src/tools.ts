import { buildReport, candidateRules } from "../../src/lib/core/match";
import { BM25 } from "../../src/lib/core/bm25";
import { checkBrandWords } from "../../src/lib/core/brands";
import { kb } from "../../src/lib/core/kb";
import type { Category, CheckInput, Feature, Rule } from "../../src/lib/core/types";

const bm25 = new BM25(kb.rules);
const CATS = ["appliance", "power", "toy", "cosmetic"];
const FEATS = ["wireless", "battery", "charger", "powerbank", "kids"];

function brief(r: Rule) {
  return { id: r.id, title: r.title, kind: r.kind, mandatory: r.mandatory, needs_review: r.needs_review, requirement: r.requirement,
    excerpts: r.excerpts.map((e) => ({ text: e.text.slice(0, 400), verification: e.verification })) };
}

export interface ToolSpec { name: string; description: string; parameters: Record<string, unknown>; run: (args: any) => unknown }

export function makeTools(input: CheckInput, imageText = ""): ToolSpec[] {
  return [
    {
      name: "lookup_rules",
      description: "按目标国家、品类、功能特征和电器类型，从知识库确定性匹配合规规则。返回规则编号、要求和原文摘录。必须先调用。",
      parameters: { type: "object", properties: {
        category: { type: "string", enum: CATS, description: "appliance=小家电, power=充电器/适配器/移动电源, toy=玩具, cosmetic=化妆品" },
        features: { type: "array", items: { type: "string", enum: FEATS } },
        items: { type: "array", items: { type: "string" }, description: "电器类型，如 rice_cooker,kettle,fan,hair_dryer,iron,toaster_oven,air_fryer,deep_fryer,microwave,blender,thermo_pot,massager,air_purifier,multi_cooker,coffee_maker,induction,vacuum" },
      }, required: ["category"] },
      run: (a) => {
        const category = CATS.includes(a?.category) ? (a.category as Category) : undefined;
        const r = buildReport(input, { category, features: (a?.features || []).filter((f: string) => FEATS.includes(f)) as Feature[], items: a?.items || [], imageText });
        return { category: r.category, items: r.items, features: r.features,
          matched: [...r.certs, ...r.display, ...r.platform, ...r.customs].map((h) => ({ ...brief(h.rule), reason: h.reason })),
          review: r.review, brand_hits: r.brand.hits };
      },
    },
    {
      name: "search_kb",
      description: "BM25 关键词检索知识库（限当前国家和通用规则），用于查找 lookup_rules 可能漏掉的条款。",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      run: (a) => bm25.search(String(a?.query || "").slice(0, 200), 5, (r) => r.country === input.country || r.country === "ALL").map((x) => brief(x.rule)),
    },
    {
      name: "check_brand_words",
      description: "检查文本中的品牌词、仿冒暗示词（同款/高仿/1:1 等）、兼容性描述。",
      parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      run: (a) => checkBrandWords(`${String(a?.text || "").slice(0, 2400)}\n${imageText}`),
    },
  ];
}

export function allowedRuleIds(input: CheckInput, category: Category | null): Set<string> {
  return new Set(candidateRules(input.country, category).map((r) => r.id));
}
