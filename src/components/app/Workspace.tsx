"use client";
import { useState } from "react";
import { runCheck } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { composeCountries, type CountryView } from "@/lib/report";
import { splitInfo } from "@/lib/core/verdict";
import { CheckForm, CheckProgress, EMPTY_FORM, type FormState } from "./CheckForm";
import { ResultView } from "./ResultView";
import { toast } from "@/components/ui/toast";

type Phase = { k: "form"; error?: string } | { k: "loading" } | { k: "result"; title: string; views: CountryView[]; notice?: string };

/** Tell the user when some / all images could not be read (the check itself still ran on text + the images that worked). */
function imageNotice(f: { images: number; images_failed?: number } | null, err: string | null, sent: number): string | undefined {
  if (!sent) return undefined;
  if (!f) return err ? "图片识别失败或超时，本次结果仅依据文字信息；可稍后重新检查。" : undefined;
  return f.images_failed ? `有 ${f.images_failed} 张图片识别失败或超时，已使用其余 ${f.images - f.images_failed} 张图片和文字信息检查；结果可能不完整，可稍后重试。` : undefined;
}

export function Workspace() {
  const { quota, refresh } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [phase, setPhase] = useState<Phase>({ k: "form" });

  const submit = async () => {
    setPhase({ k: "loading" }); window.scrollTo({ top: 0, behavior: "smooth" });
    const imgs = form.images;
    const res = await runCheck(form.info, form.countries, imgs.map((i) => i.dataUrl));
    refresh();
    if (!res.ok) {
      if (res.status === 401) { toast("登录已失效，请重新登录", { tone: "info" }); return; }
      setPhase({ k: "form", error: res.message }); return;
    }
    setPhase({ k: "result", title: res.input.title === "（见图片）" ? splitInfo(form.info).title : res.input.title, views: composeCountries(res), notice: imageNotice(res.image_facts, res.image_error, imgs.length) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const again = () => { setForm(EMPTY_FORM); setPhase({ k: "form" }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      {phase.k === "form" && (
        <>
          <div className="mb-5 px-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">商品上架合规检查</h1>
            <p className="mt-1 text-sm text-muted-foreground">上传商品图片或填写商品信息，查看在泰国、菲律宾、马来西亚上架前需要办理的证书。</p>
          </div>
          <CheckForm value={form} onChange={setForm} onSubmit={submit} error={phase.error} remaining={quota ? Math.max(0, quota.limit - quota.used) : null} />
        </>
      )}
      {phase.k === "loading" && <CheckProgress countries={form.countries} images={form.images.length} />}
      {phase.k === "result" && <ResultView title={phase.title} views={phase.views} notice={phase.notice} onAgain={again} />}
    </main>
  );
}
