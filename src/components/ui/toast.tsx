"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastOpts { action?: { label: string; onClick: () => void }; duration?: number; tone?: "success" | "info"; onClose?: () => void }
interface T extends ToastOpts { id: number; msg: string }
type L = (t: T[]) => void;
let items: T[] = []; let seq = 0; const subs = new Set<L>();
const emit = () => subs.forEach((f) => f(items));
/** Pending toasts survive a client-side navigation (e.g. logout → home) because state lives at module level. */
export function toast(msg: string, o: ToastOpts = {}) {
  const t: T = { id: ++seq, msg, tone: "success", duration: 4000, ...o };
  items = [...items, t].slice(-3); emit();
  setTimeout(() => dismiss(t.id), t.duration);
  return t.id;
}
export function dismiss(id: number) {
  const t = items.find((x) => x.id === id); if (!t) return;
  items = items.filter((x) => x.id !== id); emit(); t.onClose?.();
}

export function Toaster() {
  const [list, setList] = useState<T[]>(items);
  useEffect(() => { subs.add(setList); return () => { subs.delete(setList); }; }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {list.map((t) => (
        <div key={t.id} role="status" className={cn("pointer-events-auto flex w-full max-w-sm animate-fade-up items-center gap-2.5 rounded-xl border bg-foreground px-4 py-3 text-sm text-background shadow-xl")}>
          {t.tone === "info" ? <Info className="size-4 shrink-0 opacity-80" /> : <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />}
          <span className="min-w-0 flex-1">{t.msg}</span>
          {t.action && <button type="button" className="shrink-0 rounded-md px-2 py-1 text-[13px] font-semibold text-sky-300 hover:bg-background/10" onClick={() => { const a = t.action!; t.onClose = undefined; dismiss(t.id); a.onClick(); }}>{t.action.label}</button>}
          <button type="button" aria-label="关闭" className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)}><X className="size-3.5" /></button>
        </div>
      ))}
    </div>
  );
}
