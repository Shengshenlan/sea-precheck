export type Country = "TH" | "PH" | "MY";
export type Category = "appliance" | "power" | "toy" | "cosmetic";
export type Platform = "tiktok" | "shopee" | "lazada";
export type Feature = "wireless" | "battery" | "charger" | "powerbank" | "kids";
export type Verification = "verified" | "verified_ocr" | "paraphrase";

export interface Excerpt {
  text: string; lang: string; source_url: string; source_title: string;
  source_type: "official" | "official_translation" | "secondary" | "platform";
  verification: Verification; snapshot: string | null; retrieved_date: string;
}
export interface Rule {
  id: string; country: Country | "ID" | "VN" | "ALL"; categories: (Category | "*")[];
  items: string[]; features: Feature[]; platforms: Platform[];
  kind: "cert" | "display" | "platform" | "customs" | "review" | "ip";
  mandatory: boolean; needs_review: boolean; requires_cert_prefix?: string;
  title: string; cert?: string; authority: string; requirement: string;
  effective_date: string | null; retrieved_date: string;
  excerpts: Excerpt[]; next_steps: string[];
}
export interface KB { version: string; generated: string; rules: Rule[] }

export interface CheckInput {
  title: string; description?: string; category?: Category | "auto";
  country: Country; platform: Platform;
}
export interface RuleHit { rule: Rule; reason: string }
export interface BrandHit { term: string; brand: string; type: "brand" | "counterfeit" | "compat" | "dupe"; source?: "text" | "image" }
export interface ReviewItem { text: string; reason: string }
export interface LlmNote {
  rule_id: string; quote: string; explanation: string;
  status: "verified" | "待人工复核"; problem?: string;
}
export interface Report {
  kb_version: string; input: CheckInput;
  category: Category | null; category_source: "user" | "auto" | "llm" | "none";
  items: string[]; features: Feature[];
  certs: RuleHit[]; display: RuleHit[]; platform: RuleHit[]; customs: RuleHit[];
  other_markets: RuleHit[];
  review: ReviewItem[];
  brand: { hits: BrandHit[]; links: { name: string; url: string }[] };
  risk: { level: "高" | "中" | "低" | "待复核"; reasons: string[] };
  next_steps: string[];
  image_facts?: ImageFacts;
  llm?: { model: string; summary: string; notes: LlmNote[]; extra_rule_ids: string[]; latency_ms: number; dropped: number };
}

/** Structured facts a vision model extracted from product/packaging photos. Used only as evidence, never as a citation. */
export interface ImageFacts {
  product_type: string; brands: string[]; marks: string[]; plug_type: string | null;
  battery: boolean | null; wireless: boolean | null; wireless_evidence: string;
  label_text: string; label_langs: string[]; notes: string; model: string; images: number;
}
export type EvidenceSource = "text" | "image";
