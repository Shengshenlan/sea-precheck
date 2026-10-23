import type { Excerpt, RuleHit } from "@/lib/core/types";

const SRC_BADGE: Record<Excerpt["source_type"], [string, string]> = {
  official: ["官方原文", "bg-emerald-100 text-emerald-800"],
  official_translation: ["官方英译本", "bg-emerald-100 text-emerald-800"],
  secondary: ["第三方解读", "bg-amber-100 text-amber-800"],
  platform: ["平台规则", "bg-sky-100 text-sky-800"],
};

export function ExcerptBlock({ e }: { e: Excerpt }) {
  const para = e.verification === "paraphrase";
  const [label, cls] = para ? ["转述（非原文）· 待人工复核", "bg-rose-100 text-rose-800"] : SRC_BADGE[e.source_type];
  return (
    <figure className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
        <span className={`rounded px-1.5 py-0.5 font-medium ${cls}`}>{label}</span>
        {e.verification === "verified_ocr" && <span className="rounded bg-neutral-200 px-1.5 py-0.5">扫描件 OCR</span>}
        <span className="text-neutral-500">抓取于 {e.retrieved_date}</span>
      </div>
      <blockquote className={`whitespace-pre-line break-words ${para ? "text-neutral-600" : "font-serif text-neutral-800"}`} lang={e.lang}>
        {para ? e.text : `“${e.text}”`}
      </blockquote>
      <figcaption className="mt-1 break-all text-xs">
        <a className="text-blue-700 underline" href={e.source_url} target="_blank" rel="noopener noreferrer">{e.source_title}</a>
      </figcaption>
    </figure>
  );
}

export function RuleCard({ hit, compact }: { hit: RuleHit; compact?: boolean }) {
  const r = hit.rule;
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-semibold text-neutral-900">{r.title}</h4>
        <div className="flex gap-1 text-xs">
          {r.mandatory && <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">强制</span>}
          {r.needs_review && <span className="rounded bg-amber-500 px-1.5 py-0.5 text-white">待人工复核</span>}
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-700">{r.requirement}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs text-neutral-600">
        {r.cert && (<><dt>需要</dt><dd className="text-neutral-800">{r.cert}</dd></>)}
        <dt>主管机构</dt><dd>{r.authority}</dd>
        {r.effective_date && (<><dt>生效日期</dt><dd>{r.effective_date}</dd></>)}
        <dt>匹配原因</dt><dd>{hit.reason}</dd>
        <dt>规则编号</dt><dd className="font-mono">{r.id}</dd>
      </dl>
      {!compact && <details className="mt-1" open={r.excerpts.length <= 2}>
        <summary className="cursor-pointer text-xs text-blue-700">依据原文（{r.excerpts.length} 段）</summary>
        {r.excerpts.map((e, i) => <ExcerptBlock key={i} e={e} />)}
      </details>}
    </article>
  );
}
