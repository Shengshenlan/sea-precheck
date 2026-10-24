"use client";
import Link from "next/link";
import { ArrowRight, Camera, ClipboardList } from "lucide-react";
import snapshot from "@/data/demo-check.json";
import type { CheckResponse } from "@/lib/api";
import { composeCountries } from "@/lib/report";
import { splitInfo } from "@/lib/core/verdict";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryTag } from "@/components/site/CountryTag";
import { ResultView } from "./ResultView";

/**
 * Static “示例报告”: a frozen copy of a REAL check (scripts/capture-demo.ts → src/data/demo-check.json) rendered with the very same
 * ResultView the signed-in workspace uses. No login, no network, no Worker.
 */
export function DemoReport() {
  const res = snapshot.response as unknown as CheckResponse;
  const views = composeCountries(res);
  const when = new Date(snapshot.captured_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric" });
  return (
    <main className="relative mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 opacity-50" />
      <section data-testid="demo-banner" className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-accent via-card to-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary ring-1 ring-inset ring-primary/20">
          <Camera className="size-3.5" />静态快照 · 非实时检查
        </span>
        <h1 className="mt-3 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
          示例报告<span className="block text-[15px] font-normal text-muted-foreground sm:inline sm:text-base">（真实检查结果的静态快照，未登录也可浏览）</span>
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          下面是 {when} 对一款充电器真实运行一次检查得到的完整结果，页面样式与功能和登录后的结果页完全相同；点击卡片底部的“查看详细依据”可展开法规原文与官方来源链接。
        </p>
      </section>

      <Card className="mt-4 p-5 sm:p-6" data-testid="demo-input">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70"><ClipboardList className="size-3.5" />本次输入的商品信息</p>
          <div className="flex items-center gap-1.5">{(snapshot.countries as ("TH" | "MY")[]).map((c) => <CountryTag key={c} c={c} />)}</div>
        </div>
        <p className="mt-3 whitespace-pre-line rounded-xl bg-muted/50 px-4 py-3 text-[13.5px] leading-relaxed text-foreground/90">{snapshot.info}</p>
      </Card>

      <div className="mt-6">
        <ResultView title={splitInfo(snapshot.info).title} views={views} />
      </div>

      <Card className="mt-6 flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-[15px] font-semibold tracking-tight">想检查自己的商品？</p>
        <p className="text-sm text-muted-foreground">登录后上传商品图片或填写商品信息，约半分钟得到同样的结果。</p>
        <Button asChild variant="gradient" size="lg" className="w-full sm:w-auto"><Link href="/">登录并开始检查<ArrowRight /></Link></Button>
      </Card>
    </main>
  );
}
