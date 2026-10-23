import Link from "next/link";
import { kb } from "@/lib/core/kb";
import { RuleCard } from "@/components/RuleCard";
import { COUNTRY_ZH } from "@/lib/core/match";

export const metadata = { title: "规则与来源 · 东南亚跨境上架前合规预检" };

export default function Sources() {
  const groups = ["TH", "PH", "MY", "ALL", "ID", "VN"] as const;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link href="/" className="text-sm text-blue-700 underline">← 返回预检</Link>
      <h1 className="mt-2 text-2xl font-bold">知识库：全部规则与来源</h1>
      <p className="mt-1 text-sm text-neutral-600">版本 {kb.version}，共 {kb.rules.length} 条。“转述（非原文）”表示官方页面无法抓取，只能概括，需人工核对。</p>
      {groups.map((g) => (
        <section key={g} className="mt-6">
          <h2 className="text-lg font-bold">{COUNTRY_ZH[g]}</h2>
          <div className="mt-2 space-y-2.5">{kb.rules.filter((r) => r.country === g).map((r) => <RuleCard key={r.id} hit={{ rule: r, reason: "—" }} />)}</div>
        </section>
      ))}
    </main>
  );
}
