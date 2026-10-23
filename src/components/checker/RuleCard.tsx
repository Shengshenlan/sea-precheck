import { BadgeCheck, Building2, CalendarClock, ChevronDown, ExternalLink, FileText, Hash, Quote, Target } from "lucide-react";
import type { Excerpt, RuleHit } from "@/lib/core/types";
import { Badge } from "@/components/ui/badge";

const SRC: Record<Excerpt["source_type"], [string, "green" | "amber" | "sky"]> = {
  official: ["官方原文", "green"], official_translation: ["官方英译本", "green"], secondary: ["第三方解读", "amber"], platform: ["平台规则", "sky"],
};

export function ExcerptPanel({ e, open }: { e: Excerpt; open?: boolean }) {
  const para = e.verification === "paraphrase";
  const [label, tone] = para ? ["转述（非原文）", "rose" as const] : SRC[e.source_type];
  return (
    <details className="group rounded-xl border bg-muted/40 transition-colors open:bg-muted/60" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs [&::-webkit-details-marker]:hidden">
        <Quote className="size-3.5 text-muted-foreground" />
        <Badge tone={tone}>{label}</Badge>
        {para && <Badge tone="amber">待复核</Badge>}
        {e.verification === "verified_ocr" && <Badge>扫描件 OCR</Badge>}
        <span className="truncate text-muted-foreground">{e.source_title}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground"><CalendarClock className="size-3" />{e.retrieved_date}<ChevronDown className="size-3.5 transition-transform group-open:rotate-180" /></span>
      </summary>
      <div className="border-t px-3.5 py-3">
        <blockquote lang={e.lang} className={`whitespace-pre-line break-words border-l-2 pl-3 text-[13px] leading-relaxed ${para ? "border-rose-300 text-muted-foreground" : "border-primary/50 font-serif text-foreground/90"}`}>
          {para ? e.text : `“${e.text}”`}
        </blockquote>
        {para && <p className="mt-2 text-[11px] text-muted-foreground">官方页面无法抓取原文，此处为概括转述，请以链接中的官方内容为准。</p>}
        <a className="mt-2 inline-flex max-w-full items-center gap-1 break-all text-xs text-primary hover:underline" href={e.source_url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-3 shrink-0" />{e.source_url}
        </a>
      </div>
    </details>
  );
}

export function RuleCard({ hit, compact }: { hit: RuleHit; compact?: boolean }) {
  const r = hit.rule;
  const official = r.excerpts.find((e) => e.source_type === "official" || e.source_type === "official_translation") || r.excerpts[0];
  return (
    <article className="group/card rounded-xl border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <h4 className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug">{r.title}</h4>
        <div className="flex flex-wrap gap-1">
          {r.mandatory ? <Badge tone="red">强制</Badge> : <Badge>建议</Badge>}
          {r.needs_review && <Badge tone="amber">待复核</Badge>}
        </div>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{r.requirement}</p>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {r.cert && <Row icon={BadgeCheck} k="需要"><span className="font-medium text-foreground">{r.cert}</span></Row>}
        <Row icon={Building2} k="主管机构">{r.authority}</Row>
        {r.effective_date && <Row icon={CalendarClock} k="生效日期">{r.effective_date}</Row>}
        <Row icon={Target} k="匹配原因">{hit.reason}</Row>
        <Row icon={Hash} k="规则编号"><code className="font-mono text-[11px]">{r.id}</code></Row>
        {official && <Row icon={FileText} k="官方链接"><a className="inline-flex items-center gap-0.5 text-primary hover:underline" href={official.source_url} target="_blank" rel="noopener noreferrer">{official.source_title.slice(0, 28)}{official.source_title.length > 28 ? "…" : ""}<ExternalLink className="size-3" /></a></Row>}
      </dl>
      {!compact && r.excerpts.length > 0 && (
        <div className="mt-3 space-y-2">
          {r.excerpts.map((e, i) => <ExcerptPanel key={i} e={e} />)}
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
