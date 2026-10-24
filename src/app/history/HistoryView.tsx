"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, ChevronRight, Inbox, Loader2, Trash2 } from "lucide-react";
import { api, normalizeStored, type HistoryItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { composeCountries, type CountryView } from "@/lib/report";
import { VERDICT_LABEL, type Verdict } from "@/lib/core/verdict";
import type { Country } from "@/lib/core/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountryTag } from "@/components/site/CountryTag";
import { ResultView } from "@/components/app/ResultView";
import { cn, fmtTime, relTime } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

const V_TONE: Record<string, string> = {
  ok: "text-emerald-700 dark:text-emerald-300", certs: "text-amber-700 dark:text-amber-300", no: "text-red-700 dark:text-red-300", unknown: "text-muted-foreground",
};
type Detail = { item: HistoryItem; title: string; views: CountryView[] };

/** Per-country verdict chips; records saved before the multi-country change only have one country + a risk level. */
function Verdicts({ it }: { it: HistoryItem }) {
  const cs: Country[] = it.countries?.length ? it.countries : it.country ? [it.country] : [];
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      {cs.map((c) => {
        const v = it.verdicts?.[c] as Verdict | undefined;
        return <span key={c} className="inline-flex items-center gap-1.5 text-xs"><CountryTag c={c} />
          {v ? <span className={cn("font-medium", V_TONE[v])}>{VERDICT_LABEL[v]}</span> : it.risk ? <span className="text-muted-foreground">{it.risk}风险</span> : null}</span>;
      })}
    </span>
  );
}

export function HistoryView() {
  const { user, ready, signOut } = useAuth();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [sel, setSel] = useState<Detail | null>(null);
  const [selErr, setSelErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const qid = Number(useSearchParams().get("id")) || null;
  const pushed = useRef(false);
  // deletions wait for the undo window; ids are hidden from the list meanwhile
  const pending = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => { if (ready && !user) router.replace("/"); }, [ready, user, router]);
  useEffect(() => { if (user) api.history().then(({ body }) => setItems(body.ok ? body.items.filter((i) => !pending.current.has(i.id)) : [])).catch(() => setItems([])); }, [user]);
  // detail view is driven by ?id= so the browser back button returns to the list
  useEffect(() => {
    if (!user || !qid) { setSel(null); setSelErr(""); return; }
    if (sel?.item.id === qid) return;
    let live = true; setSelErr("");
    api.historyItem(qid).then(({ body }) => {
      if (!live) return;
      if (!body.ok) { setSelErr("记录不存在或已删除"); return; }
      try { const res = normalizeStored(body.item); setSel({ item: body.item, title: body.item.title, views: composeCountries(res) }); window.scrollTo({ top: 0 }); }
      catch { setSelErr("该记录格式较旧，无法显示"); }
    }).catch(() => live && setSelErr("加载失败，请稍后重试"));
    return () => { live = false; };
  }, [qid, user]); // eslint-disable-line react-hooks/exhaustive-deps
  // flush pending deletions if the user leaves the page before the undo window closes
  useEffect(() => { const p = pending.current; return () => { p.forEach((t, id) => { clearTimeout(t); api.deleteHistory(id); }); p.clear(); }; }, []);

  const del = useCallback((it: HistoryItem) => {
    setItems((x) => x?.filter((i) => i.id !== it.id) || null);
    const t = setTimeout(() => { pending.current.delete(it.id); api.deleteHistory(it.id).catch(() => {}); }, 8000);
    pending.current.set(it.id, t);
    toast(`已删除「${(it.title || "仅图片").slice(0, 16)}」`, { duration: 8000, action: { label: "撤销", onClick: () => {
      clearTimeout(pending.current.get(it.id)); pending.current.delete(it.id);
      setItems((x) => (x ? [...x, it].sort((a, b) => b.created_at - a.created_at) : [it]));
      toast("已恢复", { tone: "info", duration: 2000 });
    } } });
  }, []);

  if (!ready || !user) return <div className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;

  const open = (it: HistoryItem) => { pushed.current = true; router.push(`/history/?id=${it.id}`); };
  const back = () => { if (pushed.current) { pushed.current = false; router.back(); } else router.push("/history/"); };
  const delAll = async () => {
    if (!confirm(`确定删除全部 ${items?.length || 0} 条历史记录？此操作不可撤销。`)) return;
    setBusy(true); pending.current.forEach((t) => clearTimeout(t)); pending.current.clear();
    await api.deleteHistory().catch(() => {}); setItems([]); setBusy(false); toast("已清空历史记录");
  };
  const delAccount = async () => {
    if (!confirm("确定注销账号？账号和全部历史记录将被永久删除。")) return;
    setBusy(true); await api.deleteAccount().catch(() => {}); signOut(); setBusy(false); toast("账号已注销"); router.replace("/");
  };

  if (qid) return (
    <div>
      <Button variant="ghost" size="sm" onClick={back} className="-ml-2 mb-3"><ArrowLeft />返回历史记录</Button>
      {sel ? <>
        <p className="mb-3 px-1 text-xs text-muted-foreground">检查于 {fmtTime(sel.item.created_at)}{sel.item.image_count > 0 && ` · 含 ${sel.item.image_count} 张图片（图片未保存，仅保留识别结果）`}</p>
        <ResultView title={sel.title} views={sel.views} />
      </> : selErr ? <Card className="p-8 text-center text-sm text-muted-foreground">{selErr}</Card>
        : <div className="space-y-3"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>}
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3 px-1">
        <div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">历史记录</h1><p className="mt-1 text-sm text-muted-foreground">保存最近 100 次检查（不含图片）</p></div>
        {!!items?.length && <Button variant="ghost" size="sm" onClick={delAll} disabled={busy} className="text-muted-foreground"><Trash2 />清空</Button>}
      </div>
      {items === null ? <div className="space-y-2.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}</div>
        : items.length === 0 ? (
          <Card className="grid place-items-center p-12 text-center"><Inbox className="size-8 text-muted-foreground" /><p className="mt-3 font-medium">还没有检查记录</p>
            <Button asChild variant="gradient" className="mt-4"><Link href="/">开始检查</Link></Button></Card>
        ) : (
          <ul className="space-y-2.5" data-testid="history-list">{items.map((it) => (
            <li key={it.id} className="animate-fade-up">
              <Card className="group flex items-center gap-2 p-3.5 transition-all hover:border-primary/30 hover:shadow-md sm:p-4">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => open(it)}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.title || "（仅图片）"}</p>
                    <div className="mt-1.5"><Verdicts it={it} /></div>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"><span title={fmtTime(it.created_at)}>{relTime(it.created_at)}</span>
                      {it.image_count > 0 && <span className="inline-flex items-center gap-0.5"><Camera className="size-3" />{it.image_count}</span>}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
                <Button variant="ghost" size="icon" aria-label="删除这条记录" onClick={() => del(it)} className="shrink-0 text-muted-foreground hover:text-red-600"><Trash2 /></Button>
              </Card>
            </li>))}
          </ul>
        )}
      <div className="mt-10 border-t pt-4 text-center">
        <button type="button" onClick={delAccount} disabled={busy} className="text-xs text-muted-foreground underline-offset-2 hover:text-red-600 hover:underline">{busy ? <Loader2 className="inline size-3 animate-spin" /> : "注销账号并删除全部数据"}</button>
      </div>
    </div>
  );
}
