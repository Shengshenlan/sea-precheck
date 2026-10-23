import Link from "next/link";
import { Logo } from "./Logo";
import { kb } from "@/lib/core/kb";
import { SHORT_DISCLAIMER } from "@/lib/core/disclaimer";

const KB_DATE = (kb as { generated?: string }).generated ?? "";

const COLS: { title: string; links: [string, string][] }[] = [
  { title: "产品", links: [["/check/", "合规预检"], ["/history/", "历史记录"], ["/sources/", "规则与来源"]] },
  { title: "覆盖", links: [["/sources/#TH", "泰国 TH"], ["/sources/#PH", "菲律宾 PH"], ["/sources/#MY", "马来西亚 MY"]] },
  { title: "法律", links: [["/terms/", "服务条款"], ["/privacy/", "隐私政策"], ["/sources/", "数据来源说明"]] },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">东南亚跨境电商上架前合规预检。覆盖泰国、菲律宾、马来西亚的 TikTok Shop、Shopee 与 Lazada，结论均可追溯至官方原文。</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title} className="text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{c.title}</p>
            <ul className="mt-4 space-y-2.5 text-muted-foreground">
              {c.links.map(([href, label]) => <li key={label}><Link className="transition-colors hover:text-foreground" href={href}>{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>{SHORT_DISCLAIMER}</p>
          <p className="shrink-0 tabular-nums">数据版本 {kb.version}{KB_DATE && ` · 更新于 ${KB_DATE}`}</p>
        </div>
      </div>
    </footer>
  );
}
