import Link from "next/link";
import Checker from "@/components/Checker";
import { DISCLAIMER, DISCLAIMER_TITLE } from "@/lib/core/disclaimer";
import { kb } from "@/lib/core/kb";

export default function Home() {
  const verified = kb.rules.filter((r) => r.excerpts.some((e) => e.verification !== "paraphrase")).length;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <header>
        <p className="text-xs font-medium tracking-wide text-blue-700">免费 · 个人业余项目 · 不收集数据</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">东南亚跨境上架前合规预检</h1>
        <p className="mt-2 text-neutral-700">输入商品标题，看看在<b>泰国、菲律宾、马来西亚</b>的 TikTok Shop / Shopee / Lazada 上架前，可能需要哪些认证、踩到哪些平台规则、listing 要展示什么、标题里有没有品牌词风险。</p>
        <p className="mt-1 text-sm text-neutral-600">覆盖：小家电、充电器/适配器/移动电源、玩具、化妆品。每条结论都附官方链接和原文摘录。</p>
      </header>
      <aside className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-3.5 text-sm" role="note">
        <p className="font-bold text-amber-900">⚠️ {DISCLAIMER_TITLE}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-950">{DISCLAIMER.map((d, i) => <li key={i}>{d}</li>)}</ul>
      </aside>
      <div className="mt-5"><Checker /></div>
      <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
        <p>知识库 {kb.version}：{kb.rules.length} 条规则，其中 {verified} 条有可核对的官方/第三方原文摘录。<Link className="text-blue-700 underline" href="/sources/">查看全部规则与来源</Link></p>
        <p className="mt-1">本站不使用 cookie，不存储你输入的内容。</p>
      </footer>
    </main>
  );
}
