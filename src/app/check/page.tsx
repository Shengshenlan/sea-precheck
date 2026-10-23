import Checker from "@/components/checker/Checker";
import { SHORT_DISCLAIMER } from "@/lib/core/disclaimer";
export const metadata = { title: "开始预检" };
export default function CheckPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-2xl font-bold tracking-tight">上架前合规预检</h1><p className="mt-1 text-sm text-muted-foreground">泰国 · 菲律宾 · 马来西亚 ｜ TikTok Shop · Shopee · Lazada</p></div>
        <p className="text-xs text-muted-foreground">{SHORT_DISCLAIMER}</p>
      </div>
      <Checker />
    </main>
  );
}
