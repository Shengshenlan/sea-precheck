import Link from "next/link";
import { Logo } from "./Logo";
import { kb } from "@/lib/core/kb";
import { SHORT_DISCLAIMER } from "@/lib/core/disclaimer";

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-card/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">面向中国卖家的东南亚上架前合规自查工具：泰国、菲律宾、马来西亚 · TikTok Shop / Shopee / Lazada。个人业余项目，免费使用。</p>
          <p className="mt-3 text-xs text-muted-foreground">{SHORT_DISCLAIMER}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium">产品</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/check/">开始预检</Link></li>
            <li><Link className="hover:text-foreground" href="/history/">历史记录</Link></li>
            <li><Link className="hover:text-foreground" href="/sources/">规则与来源（{kb.rules.length} 条）</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium">隐私</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>不使用 cookie、不做追踪统计</li>
            <li>图片仅用于本次识别，不保存</li>
            <li>历史记录可随时一键删除</li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">知识库 {kb.version} · 结果仅供自查，不构成法律意见</div>
    </footer>
  );
}
