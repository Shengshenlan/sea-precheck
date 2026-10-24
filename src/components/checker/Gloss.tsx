import { Fragment } from "react";
import { ExternalLink } from "lucide-react";
import { GLOSSARY, GLOSSARY_RE } from "@/lib/core/glossary";
import { THAI_RE, URL_RE, shortUrl, trimUrl } from "@/lib/text";

/** A link that opens in a new tab and shows only the short domain (full URL in the tooltip), truncated if still too long. */
export function ExtLink({ href, className = "", children }: { href: string; className?: string; children?: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={href}
      className={`inline-flex max-w-[15rem] items-baseline gap-0.5 align-bottom text-primary underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary ${className}`}>
      <span className="min-w-0 truncate">{children ?? shortUrl(href)}</span><ExternalLink className="size-3 shrink-0 self-center opacity-70" aria-hidden />
    </a>
  );
}

/** Thai script is secondary information: small, grey, never bold. */
const Thai = ({ children }: { children: string }) => <span lang="th" className="text-[0.82em] font-normal text-muted-foreground/80">{children}</span>;
function withThai(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = []; let last = 0;
  for (const m of text.matchAll(THAI_RE)) {
    out.push(text.slice(last, m.index));
    out.push(<Thai key={`${key}-${m.index}`}>{m[0]}</Thai>);
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

/**
 * Renders report text: URLs become short, clickable links (new tab, rel=noopener); known acronyms get an accessible tooltip
 * (hover / focus / tap, each term explained once per string); Thai script is shown small and grey.
 */
export function Gloss({ text }: { text: string }) {
  const parts: React.ReactNode[] = []; const seen = new Set<string>();
  let pos = 0;
  const plain = (seg: string, base: number) => {
    let last = 0;
    for (const m of seg.matchAll(GLOSSARY_RE)) {
      const term = m[1]; const i = m.index!;
      if (seen.has(term)) continue; seen.add(term);
      parts.push(...withThai(seg.slice(last, i), `t${base + last}`));
      parts.push(
        <span key={`g${base + i}`} tabIndex={0} className="group/gl relative cursor-help underline decoration-muted-foreground/50 decoration-dotted underline-offset-[3px] outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring/40" aria-label={`${term}：${GLOSSARY[term]}`}>
          {withThai(term, `gt${base + i}`)}
          <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max max-w-[min(16rem,78vw)] -translate-x-1/2 animate-fade-up rounded-lg bg-foreground px-2.5 py-1.5 text-left text-[11.5px] font-normal leading-snug text-background shadow-lg group-hover/gl:block group-focus/gl:block">
            <b className="font-semibold">{term}</b>：{GLOSSARY[term]}
          </span>
        </span>,
      );
      last = i + term.length;
    }
    parts.push(...withThai(seg.slice(last), `t${base + last}`));
  };
  for (const m of text.matchAll(URL_RE)) {
    const { url } = trimUrl(m[0]);
    plain(text.slice(pos, m.index), pos);
    parts.push(<ExtLink key={`u${m.index}`} href={url} />);
    pos = m.index! + url.length;
  }
  plain(text.slice(pos), pos);
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}
