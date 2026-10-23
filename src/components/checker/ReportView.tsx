"use client";
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle, BadgeCheck, Bot, Camera, CheckCircle2, ChevronDown, Circle, Copyright, Globe2, ListChecks, Lock,
  Megaphone, ShieldAlert, ShieldCheck, ShieldQuestion, ShoppingBag, Sparkles, Truck, Zap, Battery, Plug, Languages, Tag,
} from "lucide-react";
import type { ImageFacts, Report } from "@/lib/core/types";
import { CATEGORY_ZH, COUNTRY_ZH, PLATFORM_ZH } from "@/lib/core/match";
import type { LlmResult } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Flag } from "@/components/site/Flag";
import { RuleCard } from "./RuleCard";
import { cn } from "@/lib/utils";

const RISK = {
  高: { cls: "from-red-500 to-rose-600 shadow-red-500/30", icon: ShieldAlert, text: "高风险" },
  中: { cls: "from-amber-400 to-orange-500 shadow-amber-500/30", icon: AlertTriangle, text: "中风险" },
  低: { cls: "from-emerald-400 to-teal-500 shadow-emerald-500/30", icon: ShieldCheck, text: "低风险" },
  待复核: { cls: "from-slate-400 to-slate-500 shadow-slate-500/30", icon: ShieldQuestion, text: "待复核" },
} as const;
const CAT_SRC = { user: "手动选择", auto: "关键词识别", llm: "AI 识别", none: "—" } as const;
const LANG_ZH: Record<string, string> = { zh: "中文", en: "英文", th: "泰文", ms: "马来文", fil: "菲律宾语", tl: "菲律宾语", id: "印尼文", vi: "越南文", ja: "日文", ko: "韩文" };

export function Section({ icon: I, title, hint, count, children, tone = "primary" }: { icon: React.ComponentType<{ className?: string }>; title: string; hint?: string; count?: number; children: React.ReactNode; tone?: "primary" | "red" | "amber" | "sky" | "violet" | "green" }) {
  const tones = { primary: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300", red: "bg-red-500/10 text-red-600 dark:text-red-300", amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300", sky: "bg-sky-500/10 text-sky-600 dark:text-sky-300", violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300", green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" };
  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex items-start gap-3 border-b bg-muted/30 px-5 py-3.5">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tones[tone])}><I className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">{title}{count !== undefined && <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{count}</span>}</h3>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="space-y-3 p-4 sm:p-5">{children}</div>
    </Card>
  );
}
const Empty = () => <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">知识库中未匹配到相关条目（不代表不需要，请人工复核）</p>;

export function ReportView({ report: r, llm, loading, hasImages }: { report: Report; llm: LlmResult | null; loading: boolean; hasImages?: boolean }) {
  const risk = RISK[r.risk.level];
  const reviewCount = r.review.length + (r.llm?.notes.filter((n) => n.status !== "verified").length || 0);
  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="relative animate-fade-up overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.06] to-transparent" />
        <div className="relative flex flex-wrap items-center gap-4 p-5">
          <div className={cn("flex items-center gap-2.5 rounded-xl bg-gradient-to-br px-4 py-2.5 text-white shadow-lg", risk.cls)}>
            <risk.icon className="size-6" /><div><p className="text-[11px] leading-none opacity-85">综合风险</p><p className="mt-1 text-lg font-bold leading-none">{risk.text}</p></div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{r.input.title || "（仅图片）"}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Flag c={r.input.country} className="h-3 w-4.5" />{COUNTRY_ZH[r.input.country]}</span>·
              <span>{PLATFORM_ZH[r.input.platform]}</span>·
              <span>{r.category ? CATEGORY_ZH[r.category] : "未识别品类"}<span className="opacity-70">（{CAT_SRC[r.category_source]}）</span></span>
            </p>
          </div>
        </div>
        <div className="relative grid grid-cols-4 divide-x border-t text-center">
          {[["认证/许可", r.certs.length], ["平台规则", r.platform.length], ["展示义务", r.display.length], ["待复核", reviewCount]].map(([k, v]) => (
            <div key={k as string} className="px-2 py-3"><p className="text-lg font-bold tabular-nums">{v}</p><p className="text-[11px] text-muted-foreground">{k}</p></div>
          ))}
        </div>
        {r.risk.reasons.length > 0 && <ul className="relative space-y-1 border-t px-5 py-3 text-[13px] text-muted-foreground">{r.risk.reasons.map((x, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />{x}</li>)}</ul>}
      </Card>

      <AiPanel r={r} llm={llm} loading={loading} hasImages={hasImages} />
      {(r.image_facts || (loading && hasImages)) && <ImageFactsCard f={r.image_facts} loading={loading} />}

      <Section icon={BadgeCheck} tone="red" title="① 认证 / 许可 / 通报" hint="强制 = 未取得即上架属违规；待复核 = 知识库无法确定，需人工确认" count={r.certs.length}>
        {r.certs.length ? r.certs.map((h) => <RuleCard key={h.rule.id} hit={h} />) : <Empty />}
      </Section>
      <Section icon={ShoppingBag} tone="sky" title="② 平台禁限售规则命中" count={r.platform.length}>
        {r.platform.length ? r.platform.map((h) => <RuleCard key={h.rule.id} hit={h} />) : <Empty />}
      </Section>
      <Section icon={Megaphone} tone="violet" title="③ Listing 展示义务与违规后果" count={r.display.length}>
        {r.display.length ? r.display.map((h) => <RuleCard key={h.rule.id} hit={h} />) : <Empty />}
      </Section>
      <BrandCard r={r} />
      {r.customs.length > 0 && <Section icon={Truck} tone="amber" title="税费 / 清关提示" count={r.customs.length}>{r.customs.map((h) => <RuleCard key={h.rule.id} hit={h} compact />)}</Section>}
      <NextSteps r={r} reviewCount={reviewCount} />
      {r.other_markets.length > 0 && (
        <details className="group rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <Globe2 className="size-4 text-muted-foreground" />也要卖印尼 / 越南？<span className="text-xs font-normal text-muted-foreground">仅提示，未做完整检查</span>
            <span className="ml-auto flex gap-1"><Flag c="ID" /><Flag c="VN" /></span><ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t p-4 sm:p-5">{r.other_markets.map((h) => <RuleCard key={h.rule.id} hit={h} compact />)}</div>
        </details>
      )}
      <p className="px-1 text-center text-xs text-muted-foreground">知识库版本 {r.kb_version} · 结果仅供自查，不构成法律意见 · 以官方原文为准</p>
    </div>
  );
}

function AiPanel({ r, llm, loading, hasImages }: { r: Report; llm: LlmResult | null; loading: boolean; hasImages?: boolean }) {
  if (loading) return (
    <Card className="animate-fade-up p-5">
      <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 animate-pulse text-primary" />AI 正在补充分析{hasImages ? "（含图片识别）" : ""}…<span className="text-xs font-normal text-muted-foreground">约 {hasImages ? "15–45" : "5–30"} 秒，下方规则结果已可查看</span></div>
      <div className="mt-4 space-y-2.5"><Skeleton className="h-3.5 w-11/12" /><Skeleton className="h-3.5 w-4/5" /><Skeleton className="h-3.5 w-2/3" /></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
    </Card>
  );
  if (llm && !llm.ok) {
    if (llm.reason === "login_required") return (
      <Card className="relative animate-fade-up overflow-hidden border-primary/30 p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-400/20 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-md"><Lock className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">以上为纯规则结果 · 登录解锁 AI 分析与图片识别</p>
            <p className="mt-0.5 text-sm text-muted-foreground">AI 会读懂标题里的隐含信息（蓝牙、电池、儿童适用…）、识别包装上的认证标志，并逐字校验引用原文。免费，每天 20 次。</p>
          </div>
          <Button asChild variant="gradient"><Link href="/login/?next=/check/">登录后使用</Link></Button>
        </div>
      </Card>
    );
    return <Card className="animate-fade-up flex items-center gap-2.5 p-4 text-sm text-muted-foreground"><Bot className="size-4 shrink-0" />{llm.message}</Card>;
  }
  if (!r.llm) return null;
  const ok = r.llm.notes.filter((n) => n.status === "verified");
  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-gradient-to-r from-indigo-500/[0.07] to-cyan-500/[0.05] px-5 py-3.5">
        <Sparkles className="size-4 text-primary" /><h3 className="text-[15px] font-semibold">AI 补充分析</h3>
        <Badge tone="blue">{r.llm.model}</Badge><span className="text-xs text-muted-foreground">{(r.llm.latency_ms / 1000).toFixed(1)}s</span>
        <span className="ml-auto text-[11px] text-muted-foreground">AI 不能新增知识库外的规则 · 引用已逐字校验</span>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-sm leading-relaxed">{r.llm.summary}</p>
        {r.llm.notes.length > 0 && <ul className="grid gap-2">
          {r.llm.notes.map((n, i) => (
            <li key={i} className={cn("rounded-xl border p-3 text-[13px]", n.status === "verified" ? "bg-muted/30" : "border-amber-300/70 bg-amber-50/60 dark:bg-amber-500/5")}>
              <div className="flex flex-wrap items-center gap-1.5"><code className="font-mono text-[11px] text-muted-foreground">{n.rule_id}</code>
                {n.status === "verified" ? <Badge tone="green"><CheckCircle2 />原文已校验</Badge> : <Badge tone="amber">待复核：{n.problem}</Badge>}</div>
              <p className="mt-1.5 leading-relaxed">{n.explanation}</p>
              {n.status === "verified" && <p className="mt-1.5 border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground">“{n.quote}”</p>}
            </li>))}
        </ul>}
        <p className="text-[11px] text-muted-foreground">{ok.length}/{r.llm.notes.length} 条引用通过逐字校验{r.llm.dropped > 0 ? ` · 已丢弃 ${r.llm.dropped} 条无法核对的模型输出` : ""}</p>
      </div>
    </Card>
  );
}

export function ImageFactsCard({ f, loading }: { f?: ImageFacts; loading?: boolean }) {
  if (!f) return loading ? null : null;
  const tri = (v: boolean | null) => (v === null ? "不确定" : v ? "是" : "否");
  return (
    <Section icon={Camera} tone="green" title="图片识别结果" hint={`${f.model} 从 ${f.images} 张图片中提取 · 仅作为匹配证据，不作为法规依据`}>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Fact icon={Tag} k="商品类型">{f.product_type || "—"}</Fact>
        <Fact icon={Copyright} k="品牌 / 商标">{f.brands.length ? f.brands.join("、") : "未识别"}</Fact>
        <Fact icon={BadgeCheck} k="认证标志">{f.marks.length ? <span className="flex flex-wrap gap-1">{f.marks.map((m) => <Badge key={m} tone="green">{m}</Badge>)}</span> : "未识别到"}</Fact>
        <Fact icon={Plug} k="插头">{f.plug_type || "—"}</Fact>
        <Fact icon={Battery} k="含电池">{tri(f.battery)}</Fact>
        <Fact icon={Zap} k="无线功能">{tri(f.wireless)}{f.wireless && f.wireless_evidence ? <span className="text-muted-foreground">（{f.wireless_evidence}）</span> : null}</Fact>
        <Fact icon={Languages} k="标签语言">{f.label_langs.length ? f.label_langs.map((l) => LANG_ZH[l] || l).join("、") : "—"}</Fact>
      </div>
      {f.label_text && <details className="group rounded-xl border bg-muted/40"><summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">识别到的标签文字<ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" /></summary><p className="border-t px-3.5 py-3 text-[13px] leading-relaxed">{f.label_text}</p></details>}
      {f.marks.length > 0 && <p className="text-xs text-muted-foreground">注意：包装上印有标志 ≠ 已取得有效认证。请向供应商索取证书编号并在官方数据库核验。</p>}
    </Section>
  );
}
const Fact = ({ icon: I, k, children }: { icon: React.ComponentType<{ className?: string }>; k: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-2.5 rounded-xl border bg-card p-3"><I className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 text-[13px]"><p className="text-[11px] text-muted-foreground">{k}</p><div className="mt-0.5 break-words font-medium">{children}</div></div></div>
);

function BrandCard({ r }: { r: Report }) {
  const TXT = { brand: (b: string) => `疑似他人品牌：${b}。无授权使用可能构成商标侵权，平台可直接下架。`, counterfeit: () => "仿冒暗示词，平台通常按假货处理。", compat: (b: string) => `兼容性描述（${b}）。只能如实说明兼容，不要放在标题开头、不要用对方 logo。`, dupe: () => "“平替/dupe”类表述会把他人品牌和你的商品关联，容易被投诉。" };
  return (
    <Section icon={Copyright} tone="amber" title="④ 商标 / 品牌词风险" hint="只做词表提醒，不能证明“不侵权”" count={r.brand.hits.length}>
      {r.brand.hits.length ? (
        <ul className="grid gap-2">{r.brand.hits.map((h, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border p-3 text-[13px]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div><p className="flex flex-wrap items-center gap-1.5"><b>“{h.term}”</b>{h.source === "image" && <Badge tone="green"><Camera />来自图片</Badge>}</p><p className="mt-0.5 text-muted-foreground">{TXT[h.type](h.brand)}</p></div>
          </li>))}</ul>
      ) : <p className="rounded-xl border border-dashed p-3 text-[13px] text-muted-foreground">词表中未命中品牌词或仿冒暗示词。<b className="text-foreground">这不代表没有侵权风险</b>（外观设计、图片版权、未收录品牌都可能被投诉）。</p>}
      <div><p className="mb-2 text-xs text-muted-foreground">请自行检索商标数据库：</p>
        <div className="flex flex-wrap gap-2">{r.brand.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40 hover:text-primary">{l.name} ↗</a>)}</div></div>
    </Section>
  );
}

function NextSteps({ r, reviewCount }: { r: Report; reviewCount: number }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setDone((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <Section icon={ListChecks} tone="primary" title="⑤ 下一步清单" hint={`${done.size}/${r.next_steps.length} 已完成 · ${reviewCount} 项待复核（勾选状态仅保存在本页）`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-500" style={{ width: `${r.next_steps.length ? (done.size / r.next_steps.length) * 100 : 0}%` }} /></div>
      <ul className="grid gap-1.5">{r.next_steps.map((s, i) => (
        <li key={i}><button type="button" onClick={() => toggle(i)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-muted">
          {done.has(i) ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />}
          <span className={cn("leading-relaxed", done.has(i) && "text-muted-foreground line-through")}>{s}</span></button></li>))}
      </ul>
      {r.review.length > 0 && <div className="rounded-xl border border-amber-300/70 bg-amber-50/60 p-3.5 text-[13px] dark:bg-amber-500/5">
        <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300"><ShieldQuestion className="size-4" />待复核</p>
        <ul className="mt-1.5 space-y-1">{r.review.map((x, i) => <li key={i}>{x.text} <span className="text-muted-foreground">—— {x.reason}</span></li>)}</ul>
      </div>}
    </Section>
  );
}
