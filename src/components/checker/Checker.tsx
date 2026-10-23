"use client";
import { useRef, useState, useMemo } from "react";
import { Loader2, Radar, ScanSearch, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { CATEGORY_ZH, MAX_DESC, MAX_TITLE } from "@/lib/core/match";
import type { Category, CheckInput, Country, Platform } from "@/lib/core/types";
import { API_URL, fetchLlm, type LlmResult } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { composeReport } from "@/lib/report";
import type { PreparedImage } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Flag } from "@/components/site/Flag";
import { ImageDrop } from "./ImageDrop";
import { ReportView } from "./ReportView";

export const EXAMPLES: { label: string; input: CheckInput }[] = [
  { label: "泰国 · 蓝牙空气炸锅", input: { title: "智能空气炸锅 5L 家用 可视窗口 蓝牙APP控制 小米同款", description: "1400W 220V，带 APP 远程控制", category: "auto", country: "TH", platform: "tiktok" } },
  { label: "马来 · 65W 氮化镓充电器", input: { title: "65W 氮化镓快充充电器 PD 三口 适用于 iPhone/Samsung", description: "英规插头 Type-C 输出", category: "auto", country: "MY", platform: "shopee" } },
  { label: "菲律宾 · 美白面霜", input: { title: "烟酰胺美白祛斑面霜 50g 平替大牌", description: "淡斑提亮 7 天见效", category: "auto", country: "PH", platform: "lazada" } },
];
const CAT_SHORT: Record<Category, string> = { appliance: "小家电", power: "充电/电源", toy: "玩具", cosmetic: "化妆品" };

export default function Checker() {
  const { user, ready, refresh } = useAuth();
  const [input, setInput] = useState<CheckInput>({ title: "", description: "", category: "auto", country: "TH", platform: "shopee" });
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [submitted, setSubmitted] = useState<{ input: CheckInput; images: number } | null>(null);
  const [llm, setLlm] = useState<LlmResult | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const loggedIn = !!user;

  const report = useMemo(() => (submitted ? composeReport(submitted.input, llm) : null), [submitted, llm]);

  async function run(i: CheckInput, imgs: PreparedImage[]) {
    if (!i.title.trim() && !imgs.length) return;
    abortRef.current?.abort();
    const ctl = new AbortController(); abortRef.current = ctl;
    const useImgs = loggedIn ? imgs : [];
    setSubmitted({ input: { ...i }, images: useImgs.length }); setLlm(null);
    if (window.innerWidth < 1024) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    if (!API_URL || !loggedIn) { setLlm(await fetchLlm(i, [])); return; }
    setLoading(true);
    const r = await fetchLlm(i, useImgs.map((x) => x.dataUrl), ctl.signal);
    if (!ctl.signal.aborted) { setLlm(r); setLoading(false); if (r.ok) refresh(); }
  }
  const set = <K extends keyof CheckInput>(k: K, v: CheckInput[K]) => setInput((p) => ({ ...p, [k]: v }));
  const canRun = !!input.title.trim() || images.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <Card className="p-5 lg:sticky lg:top-20">
        <form onSubmit={(e) => { e.preventDefault(); run(input, images); }} className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-primary"><ScanSearch className="size-4" /></span>
            <div><h2 className="text-[15px] font-semibold">商品信息</h2><p className="text-xs text-muted-foreground">标题必填，描述和图片越详细结果越准</p></div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex.label} type="button" onClick={() => { setInput(ex.input); run(ex.input, images); }}
                className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-all hover:-translate-y-px hover:border-primary/40 hover:text-primary">
                <Wand2 className="size-3" />{ex.label}</button>
            ))}
          </div>
          <div>
            <Label htmlFor="title">商品标题 <span className="text-red-500">*</span></Label>
            <Input id="title" maxLength={MAX_TITLE} value={input.title} placeholder="例如：家用迷你电饭煲 1.2L 智能预约" onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="desc">商品描述 <span className="font-normal text-muted-foreground">（可选）</span></Label>
            <Textarea id="desc" rows={3} maxLength={MAX_DESC} value={input.description} placeholder="功率、电压、是否带蓝牙/电池、适用年龄、成分等" onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <Label>商品 / 包装图片 <span className="font-normal text-muted-foreground">（可选 · AI 识别）</span></Label>
            <ImageDrop images={images} onChange={setImages} locked={ready && !loggedIn} />
          </div>
          <div>
            <Label>目标国家</Label>
            <Segmented label="目标国家" value={input.country} onChange={(v) => set("country", v as Country)}
              options={(["TH", "PH", "MY"] as const).map((c) => ({ value: c, label: <><Flag c={c} className="h-3 w-4.5" />{({ TH: "泰国", PH: "菲律宾", MY: "马来西亚" })[c]}</> }))} />
          </div>
          <div>
            <Label>平台</Label>
            <Segmented label="平台" value={input.platform} onChange={(v) => set("platform", v as Platform)}
              options={[{ value: "tiktok", label: "TikTok Shop" }, { value: "shopee", label: "Shopee" }, { value: "lazada", label: "Lazada" }]} />
          </div>
          <div>
            <Label>品类</Label>
            <Segmented label="品类" className="grid-flow-row grid-cols-5" value={input.category || "auto"} onChange={(v) => set("category", v as Category | "auto")}
              options={[{ value: "auto", label: "自动" }, ...(Object.keys(CATEGORY_ZH) as Category[]).map((c) => ({ value: c, label: CAT_SHORT[c] }))]} />
          </div>
          <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={!canRun || loading}>
            {loading ? <><Loader2 className="animate-spin" />分析中…</> : <><Radar />开始预检</>}
          </Button>
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-px size-3.5 shrink-0" />
            {loggedIn ? "规则匹配在浏览器本地完成；AI 分析会把标题、描述和图片发到后端调用大模型。图片不保存，历史记录只保存文字摘要和结果，可随时删除。"
              : "未登录：只做本地规则匹配，不上传任何数据。登录后可使用 AI 分析与图片识别。"}
          </p>
        </form>
      </Card>

      <div ref={resultRef} className="min-w-0 scroll-mt-20">
        {report ? <ReportView report={report} llm={llm} loading={loading} hasImages={(submitted?.images || 0) > 0} /> : <EmptyState />}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="relative grid min-h-[420px] place-items-center overflow-hidden p-8 text-center">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative">
        <div className="relative mx-auto grid size-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/10 [animation-duration:2.5s]" />
          <span className="absolute inset-2 rounded-full bg-primary/10" />
          <Radar className="relative size-9 text-primary" />
        </div>
        <h3 className="mt-5 text-lg font-semibold">填写左侧信息，开始扫描合规风险</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">结果会列出需要的认证、平台规则、展示义务、品牌词风险和下一步清单，每条都附官方原文。</p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"><Sparkles className="size-3.5" />也可以直接点上方的一键示例</p>
      </div>
    </Card>
  );
}
