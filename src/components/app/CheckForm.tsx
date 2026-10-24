"use client";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Country } from "@/lib/core/types";
import type { PreparedImage } from "@/lib/image";
import { COUNTRY_ZH } from "@/lib/core/match";
import { ImageDrop } from "@/components/checker/ImageDrop";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { Flag } from "@/components/site/Flag";
import { COUNTRY_TONE } from "@/components/site/CountryTag";
import { cn } from "@/lib/utils";

export const ALL_COUNTRIES: Country[] = ["TH", "PH", "MY"];
export interface FormState { info: string; countries: Country[]; images: PreparedImage[] }
export const INFO_MAX = 10000; // worker INFO_MAX_CHARS
export const EMPTY_FORM: FormState = { info: "", countries: ["TH"], images: [] };

export function CheckForm({ value, onChange, onSubmit, error, remaining }: { value: FormState; onChange: (v: FormState) => void; onSubmit: () => void; error?: string; remaining?: number | null }) {
  const { info, countries, images } = value;
  const toggle = (c: Country) => onChange({ ...value, countries: countries.includes(c) ? countries.filter((x) => x !== c) : ALL_COUNTRIES.filter((x) => x === c || countries.includes(x)) });
  const ready = countries.length > 0 && (info.trim().length >= 2 || images.length > 0) && info.length <= INFO_MAX && remaining !== 0;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(); }} className="animate-fade-up">
      <Card className="space-y-6 p-5 sm:p-7">
        <div>
          <Label>商品图片 <span className="font-normal text-muted-foreground">（可选，建议上传包装正面和标签）</span></Label>
          <ImageDrop images={images} onChange={(images) => onChange({ ...value, images })} />
        </div>
        <div>
          <Label htmlFor="info">商品信息</Label>
          <Textarea id="info" rows={6} value={info} onChange={(e) => onChange({ ...value, info: e.target.value })}
            placeholder={"商品标题、材质、供电方式、适用人群等，可直接粘贴完整商品详情（最多 10000 字）\n例如：儿童遥控汽车 3岁以上 使用4节AA电池 塑料材质"} />
          <p className={cn("mt-1 text-right text-xs tabular-nums", info.length > INFO_MAX ? "text-red-600" : "text-muted-foreground")} data-testid="info-count">
            {info.length > INFO_MAX ? `超出 ${info.length - INFO_MAX} 字，请精简后再检查 · ` : ""}{info.length} / {INFO_MAX} 字</p>
        </div>
        <div>
          <Label>销售国家 <span className="font-normal text-muted-foreground">（可多选）</span></Label>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="销售国家">
            {ALL_COUNTRIES.map((c) => {
              const on = countries.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => toggle(c)}
                  className={cn("relative flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-all",
                    on ? cn("text-foreground shadow-sm ring-1", COUNTRY_TONE[c].on) : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                  <Flag c={c} className="h-3.5 w-5" />{COUNTRY_ZH[c]}
                  {on && <Check className="absolute right-1.5 top-1.5 size-3 text-foreground/60" />}
                </button>
              );
            })}
          </div>
          {!countries.length && <p className="mt-1.5 text-xs text-red-600">请至少选择一个国家</p>}
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-300">{error}</p>}
        <div>
          <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={!ready}>开始检查</Button>
          {remaining != null && <p className="mt-2 text-center text-xs tabular-nums text-muted-foreground" data-testid="remaining">{remaining > 0 ? `今日剩余 ${remaining} 次` : "今日检查次数已用完，请明天再来"}</p>}
        </div>
      </Card>
    </form>
  );
}

/** Stage labels switch on elapsed time (the server does not stream progress, so the boundaries are estimates, not measurements). */
const STAGES_IMG = [{ label: "识别图片", until: 8 }, { label: "匹配法规", until: 18 }, { label: "生成建议", until: Infinity }];
const STAGES_TXT = [{ label: "匹配法规", until: 7 }, { label: "生成建议", until: Infinity }];

export function CheckProgress({ countries, images }: { countries: Country[]; images: number }) {
  const total = images ? 24 : 16;
  const stages = images ? STAGES_IMG : STAGES_TXT;
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT((x) => x + 0.25), 250); return () => clearInterval(id); }, []);
  const pct = Math.min(92, (1 - Math.exp(-t / (total * 0.55))) * 100);
  const cur = stages.findIndex((s) => t < s.until);
  return (
    <Card className="animate-fade-up p-7 text-center sm:p-10" aria-busy="true" data-testid="progress">
      <Loader2 className="mx-auto size-8 animate-spin text-primary" />
      <p className="mt-4 text-[17px] font-semibold">正在检查…</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        核对 {countries.map((c) => COUNTRY_ZH[c]).join("、")} 的认证与上架要求，通常需要 15–30 秒
      </p>
      <ol className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-1.5 text-[13px] sm:gap-2" aria-label="检查阶段" data-testid="progress-stages">
        {stages.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5 sm:gap-2" aria-current={i === cur ? "step" : undefined} data-state={i < cur ? "done" : i === cur ? "active" : "todo"}>
            {i > 0 && <span className="text-muted-foreground/40" aria-hidden>→</span>}
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors",
              i === cur ? "bg-accent font-medium text-primary" : i < cur ? "text-muted-foreground" : "text-muted-foreground/50")}>
              {i < cur ? <Check className="size-3" /> : i === cur ? <span className="size-1.5 animate-pulse rounded-full bg-primary" /> : null}{s.label}
            </span>
          </li>
        ))}
      </ol>
      <div className="mx-auto mt-4 h-1 max-w-sm overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-xs tabular-nums text-muted-foreground/80" role="status">已用 {Math.floor(t)} 秒{images ? " · 图片较大时上传更久" : ""}</p>
    </Card>
  );
}
