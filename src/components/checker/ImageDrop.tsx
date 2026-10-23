"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { acceptable, fmtKB, MAX_IMAGES, prepareImage, type PreparedImage } from "@/lib/image";
import { cn } from "@/lib/utils";

export function ImageDrop({ images, onChange, disabled }: { images: PreparedImage[]; onChange: (v: PreparedImage[]) => void; disabled?: boolean }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images); imagesRef.current = images;

  const add = useCallback(async (files: File[]) => {
    if (disabled) return;
    setErr(null);
    const ok = files.filter(acceptable);
    if (ok.length < files.length) setErr("仅支持 JPG / PNG / WebP 图片");
    const room = MAX_IMAGES - imagesRef.current.length;
    if (room <= 0) { setErr(`最多 ${MAX_IMAGES} 张图片`); return; }
    if (ok.length > room) setErr(`最多 ${MAX_IMAGES} 张，已忽略多余图片`);
    setBusy(true);
    try {
      const next = [...imagesRef.current];
      for (const f of ok.slice(0, room)) next.push(await prepareImage(f));
      onChange(next);
    } catch { setErr("图片无法读取，请换一张试试"); }
    setBusy(false);
  }, [disabled, onChange]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); add(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [add]);

    return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(Array.from(e.dataTransfer.files)); }}
        onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        className={cn("group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition-all",
          drag ? "scale-[1.01] border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-muted/50", (images.length >= MAX_IMAGES || disabled) && "pointer-events-none opacity-50")}>
        {busy ? <Loader2 className="size-6 animate-spin text-primary" /> : <ImagePlus className="size-6 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:text-primary" />}
        <p className="mt-2 text-sm font-medium">{busy ? "正在压缩…" : "拖拽或点击上传商品 / 包装图片"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">最多 {MAX_IMAGES} 张 · JPG / PNG / WebP · 自动压缩 · 图片仅用于本次识别，不会保存</p>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { add(Array.from(e.target.files || [])); e.target.value = ""; }} />
      </div>
      {images.length > 0 && (
        <div className="mt-3 flex items-end gap-2.5">
          {images.map((im) => (
            <div key={im.id} className="group relative size-20 sm:size-24 animate-fade-up overflow-hidden rounded-lg border bg-muted shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.dataUrl} alt={im.name} className="size-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">{fmtKB(im.bytes)}</span>
              <button type="button" aria-label="移除图片" onClick={() => onChange(images.filter((x) => x.id !== im.id))}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white opacity-90 transition hover:bg-black/80"><X className="size-3" /></button>
            </div>
          ))}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{images.length}/{MAX_IMAGES}</span>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
