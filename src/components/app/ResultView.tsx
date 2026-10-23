"use client";
import { BadgeCheck, Ban, CheckCircle2, ChevronDown, CircleHelp, FileCheck2, Info, RotateCcw, ShieldQuestion } from "lucide-react";
import type { Report, RuleHit } from "@/lib/core/types";
import type { CountryView } from "@/lib/report";
import type { Verdict } from "@/lib/core/verdict";
import { COUNTRY_ZH, CATEGORY_ZH, riskLevel } from "@/lib/core/match";
import { tierOf } from "@/lib/core/plain";
import { markWithCountry, foreignSeaMarks } from "@/lib/core/marks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Flag } from "@/components/site/Flag";
import { RuleCard } from "@/components/checker/RuleCard";
import { Gloss } from "@/components/checker/Gloss";
import { cn } from "@/lib/utils";

const TONE: Record<Verdict, { pill: string; icon: React.ComponentType<{ className?: string }>; bar: string }> = {
  ok: { pill: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300", icon: CheckCircle2, bar: "bg-emerald-500" },
  certs: { pill: "bg-amber-500/10 text-amber-800 ring-amber-600/25 dark:text-amber-300", icon: FileCheck2, bar: "bg-amber-500" },
  no: { pill: "bg-red-500/10 text-red-700 ring-red-600/20 dark:text-red-300", icon: Ban, bar: "bg-red-500" },
  unknown: { pill: "bg-muted text-muted-foreground ring-border", icon: CircleHelp, bar: "bg-slate-400" },
};

export function ResultView({ title, views, onAgain }: { title: string; views: CountryView[]; onAgain?: () => void }) {
  return (
    <div className="space-y-4" data-testid="result">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">检查结果</p>
          <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight">{title || "（仅图片）"}</h2>
        </div>
        {onAgain && <Button variant="outline" onClick={onAgain} className="shrink-0"><RotateCcw />再查一个</Button>}
      </div>
      {views.map((v) => <CountryCard key={v.country} v={v} />)}
      {onAgain && <Button variant="gradient" size="lg" className="w-full sm:hidden" onClick={onAgain}><RotateCcw />再查一个</Button>}
      <p className="px-1 text-center text-xs text-muted-foreground">结果依据公开法规整理，仅供上架前自查，不构成法律意见；以主管机构官方原文为准。</p>
    </div>
  );
}

function CountryCard({ v }: { v: CountryView }) {
  const s = v.summary; const t = TONE[s.verdict];
  return (
    <Card className="animate-fade-up overflow-hidden" data-testid={`country-${v.country}`}>
      <div className={cn("h-1", t.bar)} />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Flag c={v.country} className="h-3.5 w-5" />{COUNTRY_ZH[v.country]}</p>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset", t.pill)} data-testid="verdict"><t.icon className="size-4" />{s.label}</span>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed"><Gloss text={s.sentence} /></p>
        {!v.aiOk && v.aiMessage && <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-px size-3.5 shrink-0" />AI 分析未完成（{v.aiMessage}），以上为规则匹配结果。</p>}

        {s.certs.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-foreground/70">需要的证书</p>
            <ul className="divide-y rounded-xl border">
              {s.certs.map((c) => (
                <li key={c.name} className="flex items-start gap-3 px-3.5 py-3">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 text-[14px]"><p className="font-medium"><Gloss text={c.name} /></p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground"><Gloss text={c.where} /></p></div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {s.steps.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-foreground/70">下一步</p>
            <ol className="space-y-2">
              {s.steps.map((x, i) => (
                <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
                  <span className="mt-[3px] grid size-[18px] shrink-0 place-items-center rounded-full bg-primary/10 text-[10.5px] font-bold text-primary">{i + 1}</span>
                  <span className="min-w-0"><Gloss text={x} /></span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <details className="group border-t">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-1 px-5 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground [&::-webkit-details-marker]:hidden">
          查看详细依据<ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <Details r={v.report} />
      </details>
    </Card>
  );
}

const RISK_TONE = { 高: "red", 中: "amber", 低: "green", 待复核: "neutral" } as const;
const LANG_ZH: Record<string, string> = { zh: "中文", en: "英文", th: "泰文", ms: "马来文", fil: "菲律宾语", tl: "菲律宾语", id: "印尼文", vi: "越南文", ja: "日文", ko: "韩文" };

function Details({ r }: { r: Report }) {
  const risk = r.risk.basis ? r.risk : { ...r.risk, basis: riskLevel(r).basis };
  const must = r.certs.filter((h) => h.rule.mandatory && tierOf(h) !== "maybe");
  const maybe = r.certs.filter((h) => !(h.rule.mandatory && tierOf(h) !== "maybe"));
  const notes = r.llm?.notes || [];
  const review = [...r.review.map((x) => ({ text: x.text, reason: x.reason, verify_with: x.verify_with })),
    ...notes.filter((n) => n.status !== "verified").map((n) => ({ text: n.explanation, reason: n.problem || "引用未通过原文校验", verify_with: undefined }))];
  const f = r.image_facts;
  const evidence: string[] = [];
  if (r.category) evidence.push(`品类：${CATEGORY_ZH[r.category]}`);
  if (f?.product_type) evidence.push(`图片识别：${f.product_type}`);
  if (f?.marks.length) evidence.push(`图片中的标志：${f.marks.map(markWithCountry).join("、")}`);
  if (f?.label_langs.length) evidence.push(`标签语言：${f.label_langs.map((l) => LANG_ZH[l] || l).join("、")}`);
  if (f && f.battery !== null) evidence.push(`含电池：${f.battery ? "是" : "否"}`);
  if (f && f.wireless !== null) evidence.push(`无线功能：${f.wireless ? "是" : "否"}`);
  const foreign = f ? foreignSeaMarks(f.marks, r.input.country) : [];
  for (const h of r.brand.hits) evidence.push(`${h.type === "counterfeit" ? "仿冒暗示词" : h.type === "brand" ? "品牌词" : h.type === "compat" ? "兼容描述" : "平替表述"}：“${h.term}”${h.source === "image" ? "（来自图片）" : ""}`);

  return (
    <div className="space-y-5 bg-muted/20 px-4 pb-5 pt-4 sm:px-6">
      <Block title="风险等级">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={RISK_TONE[risk.level]} className="text-xs">{risk.level === "待复核" ? "待复核" : `${risk.level}风险`}</Badge>
          {risk.basis && <span className="text-[13px] text-muted-foreground">{risk.basis.replace(/^判定依据[：:]\s*/, "")}</span>}</div>
      </Block>
      {evidence.length > 0 && <Block title="识别依据">
        <ul className="space-y-1 text-[13px] text-muted-foreground">{evidence.map((e, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" /><span>{e}</span></li>)}</ul>
        {foreign.length > 0 && <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">图片中的 {foreign.join("、")} 标志属于其他国家，不能替代{COUNTRY_ZH[r.input.country]}的认证。</p>}
      </Block>}
      {notes.some((n) => n.status === "verified") && <Block title="法规原文摘录（已逐字校验）">
        <ul className="space-y-2">{notes.filter((n) => n.status === "verified").map((n, i) => (
          <li key={i} className="rounded-xl border bg-card p-3 text-[13px]"><p className="leading-relaxed">{n.explanation}</p><p className="mt-1.5 border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground">“{n.quote}”<code className="ml-1.5 font-mono text-[10.5px] opacity-70">{n.rule_id}</code></p></li>))}</ul>
      </Block>}
      {must.length > 0 && <Block title="必须办理的证书 · 法规依据"><Cards hits={must} /></Block>}
      {maybe.length > 0 && <Block title="可能需要"><Cards hits={maybe} /></Block>}
      {(r.platform.length > 0 || r.display.length > 0) && <Block title="平台与展示要求"><Cards hits={[...r.platform, ...r.display]} compact /></Block>}
      {review.length > 0 && <Block title="待复核">
        <ul className="space-y-1.5 rounded-xl border border-amber-300/60 bg-amber-50/50 p-3 text-[13px] dark:bg-amber-500/5">{review.map((x, i) => (
          <li key={i} className="flex items-start gap-1.5"><ShieldQuestion className="mt-0.5 size-3.5 shrink-0 text-amber-600" /><span><Gloss text={x.text} /><span className="text-muted-foreground">（{x.reason}）</span>{x.verify_with && <span className="text-amber-800/90 dark:text-amber-300/90"> → 建议向 <Gloss text={x.verify_with} /> 核实</span>}</span></li>))}</ul>
      </Block>}
      <p className="text-[11px] text-muted-foreground">知识库版本 {r.kb_version}</p>
    </div>
  );
}
const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section><h4 className="mb-2 text-xs font-semibold text-foreground/70">{title}</h4>{children}</section>
);
const Cards = ({ hits, compact }: { hits: RuleHit[]; compact?: boolean }) => <div className="space-y-2.5">{hits.map((h) => <RuleCard key={h.rule.id} hit={h} compact={compact} />)}</div>;
