import { BadgeCheck, ShieldQuestion, Building2, CalendarClock, ChevronDown, ExternalLink, FileText, Hash, Info, Quote, Target } from "lucide-react";
import type { Excerpt, ReviewItem, RuleHit } from "@/lib/core/types";
import { tierOf } from "@/lib/core/plain";
import { Badge } from "@/components/ui/badge";
import { Gloss } from "./Gloss";

const SRC: Record<Excerpt["source_type"], [string, "green" | "amber" | "sky"]> = {
  official: ["官方原文", "green"], official_translation: ["官方英译本", "green"], secondary: ["第三方解读", "amber"], platform: ["平台规则", "sky"],
};

/** Group excerpts by source document and drop identical quotes, so one source shows once with all its quotes. */
export function groupExcerpts(xs: Excerpt[]): { head: Excerpt; texts: string[] }[] {
  const out: { head: Excerpt; texts: string[] }[] = [];
  for (const e of xs) {
    const g = out.find((x) => x.head.source_url === e.source_url && x.head.verification === e.verification);
    const norm = e.text.replace(/\s+/g, " ").trim();
    if (!g) out.push({ head: e, texts: [e.text] });
    else if (!g.texts.some((t) => t.replace(/\s+/g, " ").trim() === norm)) g.texts.push(e.text);
  }
  return out;
}

export function ExcerptPanel({ e, texts, open }: { e: Excerpt; texts?: string[]; open?: boolean }) {
  const para = e.verification === "paraphrase";
  const [label, tone] = para ? ["转述（非原文）", "rose" as const] : SRC[e.source_type];
  const qs = texts || [e.text];
  return (
    <details className="group min-w-0 rounded-xl border bg-muted/40 transition-colors open:bg-muted/60" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs [&::-webkit-details-marker]:hidden">
        <Quote className="size-3.5 shrink-0 text-muted-foreground" />
        <Badge tone={tone}>{label}</Badge>
        {para && <Badge tone="amber">待复核</Badge>}
        {e.verification === "verified_ocr" && <Badge>扫描件 OCR</Badge>}
        {qs.length > 1 && <span className="shrink-0 text-muted-foreground">{qs.length} 段</span>}
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.source_title}</span>
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground"><CalendarClock className="size-3" /><span className="hidden sm:inline">{e.retrieved_date}</span><ChevronDown className="size-3.5 transition-transform group-open:rotate-180" /></span>
      </summary>
      <div className="space-y-2.5 border-t px-3.5 py-3">
        {qs.map((t, i) => (
          <blockquote key={i} lang={e.lang} className={`whitespace-pre-line break-words border-l-2 pl-3 text-[13px] leading-relaxed ${para ? "border-rose-300 text-muted-foreground" : "border-primary/50 font-serif text-foreground/90"}`}>
            {para ? t : `“${t}”`}
          </blockquote>
        ))}
        {para && <p className="text-[11px] text-muted-foreground">官方页面无法抓取原文，此处为概括转述，请以链接中的官方内容为准。</p>}
        <a className="inline-flex max-w-full items-center gap-1 break-all text-xs text-primary hover:underline" href={e.source_url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-3 shrink-0" />{e.source_url}
        </a>
      </div>
    </details>
  );
}

export function RuleCard({ hit, compact, reviews = [] }: { hit: RuleHit; compact?: boolean; reviews?: ReviewItem[] }) {
  const r = hit.rule;
  const maybe = r.kind === "cert" && r.mandatory && tierOf(hit) === "maybe";
  const official = r.excerpts.find((e) => e.source_type === "official" || e.source_type === "official_translation") || r.excerpts[0];
  const groups = groupExcerpts(r.excerpts);
  const verify = r.verify_with || r.authority;
  return (
    <article id={`rule-${r.id}`} className="group/card min-w-0 scroll-mt-24 rounded-xl border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <h4 className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug"><Gloss text={hit.title || r.title} /></h4>
        <div className="flex flex-wrap gap-1">
          {maybe ? <Badge tone="amber">可能需要</Badge> : r.mandatory ? <Badge tone="red">必须</Badge> : <Badge>建议</Badge>}
          {r.needs_review && !maybe && <Badge tone="amber">待复核</Badge>}
        </div>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground"><Gloss text={r.requirement} /></p>
      {(maybe || r.needs_review) && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/[0.08] px-2.5 py-1.5 text-[12.5px] text-amber-900 dark:text-amber-200">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>{maybe ? <>可能需要（{hit.tier_reason || "适用范围或归类尚不确定"}）：建议向 <b className="font-semibold"><Gloss text={verify} /></b> 核实是否适用；不计入风险等级。</> : <>建议向 <b className="font-semibold"><Gloss text={verify} /></b> 核实。</>}</span>
        </p>
      )}
      {reviews.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg border border-amber-300/60 bg-amber-50/50 px-2.5 py-2 text-[12.5px] dark:bg-amber-500/5" data-testid="card-review">
          {reviews.map((x, i) => (
            <li key={i} className="flex items-start gap-1.5"><ShieldQuestion className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
              <span><b className="font-medium">待核实：</b><Gloss text={x.text} /><span className="text-muted-foreground">（{x.reason}）</span>{x.verify_with && <span className="text-amber-800/90 dark:text-amber-300/90"> → 建议向 <Gloss text={x.verify_with} /> 核实</span>}</span></li>
          ))}
        </ul>
      )}
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {r.cert && <Row icon={BadgeCheck} k="需要"><span className="font-medium text-foreground"><Gloss text={r.cert} /></span></Row>}
        <Row icon={Building2} k="主管机构"><Gloss text={r.authority} /></Row>
        {r.effective_date && <Row icon={CalendarClock} k="生效日期">{r.effective_date}</Row>}
        <Row icon={Target} k="匹配原因">{hit.reason}</Row>
        <Row icon={Hash} k="规则编号"><code className="font-mono text-[11px]">{r.id}</code></Row>
        {official && <Row icon={FileText} k="官方链接"><a className="inline-flex items-center gap-0.5 text-primary hover:underline" href={official.source_url} target="_blank" rel="noopener noreferrer">{official.source_title.slice(0, 28)}{official.source_title.length > 28 ? "…" : ""}<ExternalLink className="size-3" /></a></Row>}
      </dl>
      {!compact && groups.length > 0 && (
        <div className="mt-3 space-y-2">
          {groups.map((g, i) => <ExcerptPanel key={i} e={g.head} texts={g.texts} />)}
        </div>
      )}
    </article>
  );
}

function Row({ icon: I, k, children }: { icon: React.ComponentType<{ className?: string }>; k: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <I className="mt-px size-3.5 shrink-0 text-muted-foreground/70" />
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words text-foreground/80">{children}</dd>
    </div>
  );
}
