import Link from "next/link";
import { kb } from "@/lib/core/kb";

export function Footer() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} 出海合规雷达 · 结果仅供自查，不构成法律意见</p>
        <nav className="flex items-center gap-4">
          <Link className="hover:text-foreground" href="/sources/">规则与来源</Link>
          <Link className="hover:text-foreground" href="/terms/">服务条款</Link>
          <Link className="hover:text-foreground" href="/privacy/">隐私政策</Link>
          <span className="tabular-nums">数据 {kb.version}</span>
        </nav>
      </div>
    </footer>
  );
}
