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
import { cn } from "@/lib/utils";

export const ALL_COUNTRIES: Country[] = ["TH", "PH", "MY"];
export interface FormState { info: string; countries: Country[]; images: PreparedImage[] }
export const EMPTY_FORM: FormState = { info: "", countries: ["TH"], images: [] };

export function CheckForm({ value, onChange, onSubmit, error }: { value: FormState; onChange: (v: FormState) => void; onSubmit: () => void; error?: string }) {
  const { info, countries, images } = value;
  const toggle = (c: Country) => onChange({ ...value, countries: countries.includes(c) ? countries.filter((x) => x !== c) : ALL_COUNTRIES.filter((x) => x === c || countries.includes(x)) });
  const ready = countries.length > 0 && (info.trim().length >= 2 || images.length > 0);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(); }} className="animate-fade-up">
      <Card className="space-y-6 p-5 sm:p-7">
        <div>
          <Label>商品图片 <span className="font-normal text-muted-foreground">（可选，建议上传包装正面和标签）</span></Label>
          <ImageDrop images={images} onChange={(images) => onChange({ ...value, images })} />
        </div>
        <div>
          <Label htmlFor="info">商品信息</Label>
          <Textarea id="info" rows={5} maxLength={2200} value={info} onChange={(e) => onChange({ ...value, info: e.target.value })}
            placeholder={"商品标题、材质、供电方式、适用人群等\n例如：儿童遥控汽车 3岁以上 使用4节AA电池 塑料材质"} />
        </div>
        <div>
          <Label>销售国家 <span className="font-normal text-muted-foreground">（可多选）</span></Label>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="销售国家">
            {ALL_COUNTRIES.map((c) => {
              const on = countries.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => toggle(c)}
                  className={cn("relative flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-all",
                    on ? "border-primary bg-accent text-foreground shadow-sm ring-1 ring-primary/30" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                  <Flag c={c} className="h-3.5 w-5" />{COUNTRY_ZH[c]}
                  {on && <Check className="absolute right-1.5 top-1.5 size-3 text-primary" />}
                </button>
              );
            })}
          </div>
          {!countries.length && <p className="mt-1.5 text-xs text-red-600">请至少选择一个国家</p>}
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-300">{error}</p>}
        <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={!ready}>开始检查</Button>
      </Card>
    </form>
  );
}

export function CheckProgress({ countries, images }: { countries: Country[]; images: number }) {
  const total = images ? 20 : 16;
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT((x) => x + 0.25), 250); return () => clearInterval(id); }, []);
  const pct = Math.min(95, (1 - Math.exp(-t / (total * 0.55))) * 100);
  return (
    <Card className="animate-fade-up p-8 text-center sm:p-10" aria-busy="true" data-testid="progress">
      <Loader2 className="mx-auto size-8 animate-spin text-primary" />
      <p className="mt-4 text-[17px] font-semibold">正在检查…</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        核对 {countries.map((c) => COUNTRY_ZH[c]).join("、")} 的认证与上架要求{images ? "，并识别图片" : ""}，通常需要 15–20 秒
      </p>
      <div className="mx-auto mt-6 h-1.5 max-w-sm overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}
