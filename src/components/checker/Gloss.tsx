import { Fragment } from "react";
import { GLOSSARY, GLOSSARY_RE } from "@/lib/core/glossary";

/** Wraps known acronyms in `text` with an accessible tooltip (hover / focus / tap). Each term is explained once per string. */
export function Gloss({ text }: { text: string }) {
  const parts: React.ReactNode[] = []; const seen = new Set<string>(); let last = 0;
  for (const m of text.matchAll(GLOSSARY_RE)) {
    const term = m[1]; const i = m.index!;
    if (seen.has(term)) continue; seen.add(term);
    parts.push(text.slice(last, i));
    parts.push(
      <span key={i} tabIndex={0} className="group/gl relative cursor-help underline decoration-muted-foreground/50 decoration-dotted underline-offset-[3px] outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring/40" aria-label={`${term}：${GLOSSARY[term]}`}>
        {term}
        <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max max-w-[min(16rem,78vw)] -translate-x-1/2 animate-fade-up rounded-lg bg-foreground px-2.5 py-1.5 text-left text-[11.5px] font-normal leading-snug text-background shadow-lg group-hover/gl:block group-focus/gl:block">
          <b className="font-semibold">{term}</b>：{GLOSSARY[term]}
        </span>
      </span>,
    );
    last = i + term.length;
  }
  parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}
