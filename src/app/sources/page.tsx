import { BookOpenCheck } from "lucide-react";
import { kb } from "@/lib/core/kb";
import { RuleCard } from "@/components/checker/RuleCard";
import { COUNTRY_ZH } from "@/lib/core/match";
import { Flag } from "@/components/site/Flag";

export const metadata = { title: "规则与来源" };

export default function Sources() {
  const groups = ["TH", "PH", "MY", "ALL", "ID", "VN"] as const;
  const para = kb.rules.filter((r) => r.excerpts.every((e) => e.verification === "paraphrase")).length;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><BookOpenCheck className="size-6 text-primary" />知识库：规则与来源</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">版本 {kb.version}，共 {kb.rules.length} 条规则。“转述（非原文）”表示官方页面无法抓取，只能概括，需人工核对（{para} 条仅有转述）。</p>
        </div>
        <nav className="flex flex-wrap gap-1.5">{groups.map((g) => <a key={g} href={`#${g}`} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs transition-colors hover:border-primary/40 hover:text-primary">{g !== "ALL" && <Flag c={g} className="h-2.5 w-3.5" />}{COUNTRY_ZH[g]}</a>)}</nav>
      </div>
      {groups.map((g) => {
        const rules = kb.rules.filter((r) => r.country === g);
        return (
          <section key={g} id={g} className="mt-10 scroll-mt-20">
            <h2 className="flex items-center gap-2 text-lg font-semibold">{g !== "ALL" && <Flag c={g} />}{COUNTRY_ZH[g]}<span className="text-sm font-normal text-muted-foreground">{rules.length} 条</span></h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">{rules.map((r) => <RuleCard key={r.id} hit={{ rule: r, reason: "—" }} />)}</div>
          </section>
        );
      })}
    </main>
  );
}
