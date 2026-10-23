"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Camera, ChevronRight, History, Inbox, Loader2, Lock, ShieldCheck, Trash2, UserX } from "lucide-react";
import { api, type HistoryItem, type LlmResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { composeReport } from "@/lib/report";
import { COUNTRY_ZH, PLATFORM_ZH, CATEGORY_ZH } from "@/lib/core/match";
import type { CheckInput } from "@/lib/core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Flag } from "@/components/site/Flag";
import { ReportView } from "@/components/checker/ReportView";
import { cn, fmtTime, relTime } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

const RISK_TONE = { 高: "red", 中: "amber", 低: "green", 待复核: "neutral" } as const;

export function HistoryView() {
  const { user, ready, enabled, signOut } = useAuth();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [sel, setSel] = useState<(HistoryItem & { result: LlmResponse }) | null>(null);
  const [selLoading, setSelLoading] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [selErr, setSelErr] = useState("");
  const router = useRouter();
  const qid = Number(useSearchParams().get("id")) || null;
  // deletions wait for the undo window; ids are hidden from the list meanwhile
  const pushed = useRef(false);
  const pending = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => { if (user) api.history().then(({ body }) => setItems(body.ok ? body.items : [])).catch(() => setItems([])); }, [user]);
  // detail view is driven by ?id= so the browser back button returns to the list
  useEffect(() => {
    if (!user || !qid) { setSel(null); setSelErr(""); return; }
    if (sel?.id === qid) return;
    let live = true; setSelLoading(qid); setSelErr("");
    api.historyItem(qid).then(({ body }) => { if (!live) return; if (body.ok) { setSel(body.item); window.scrollTo({ top: 0 }); } else setSelErr("记录不存在或已删除"); })
      .catch(() => live && setSelErr("加载失败，请稍后重试")).finally(() => live && setSelLoading(null));
    return () => { live = false; };
  }, [qid, user]); // eslint-disable-line react-hooks/exhaustive-deps
  // flush pending deletions if the user leaves the page before the undo window closes
  useEffect(() => { const p = pending.current; return () => { p.forEach((t, id) => { clearTimeout(t); api.deleteHistory(id); }); p.clear(); }; }, []);
  const del = useCallback((it: HistoryItem) => {
    setItems((x) => x?.filter((i) => i.id !== it.id) || null);
    const t = setTimeout(() => { pending.current.delete(it.id); api.deleteHistory(it.id).catch(() => {}); }, 10000);
    pending.current.set(it.id, t);
    toast(`已删除「${(it.title || "仅图片").slice(0, 16)}」`, { duration: 10000, action: { label: "撤销", onClick: () => {
      clearTimeout(pending.current.get(it.id)); pending.current.delete(it.id);
      setItems((x) => (x ? [...x, it].sort((a, b) => b.created_at - a.created_at) : [it]));
      toast("已恢复", { tone: "info", duration: 2000 });
    } } });
  }, []);

  if (!ready) return <div className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  if (!enabled || !user) return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-primary"><Lock className="size-5" /></span>
      <h1 className="mt-4 text-lg font-semibold">登录后查看历史记录</h1>
      <p className="mt-1 text-sm text-muted-foreground">每次 AI 预检的结果会自动保存（不含图片），方便回看和对比。</p>
      <Button asChild variant="gradient" className="mt-5"><Link href="/login/?next=/history/">登录 / 注册</Link></Button>
    </Card>
  );

  const open = (it: HistoryItem) => { pushed.current = true; router.push(`/history/?id=${it.id}`); };
  // came from the list → real "back" (keeps scroll); opened via a shared/bookmarked link → go to the list
  const back = () => { if (pushed.current) { pushed.current = false; router.back(); } else router.push("/history/"); };
  const delAll = async () => { if (!confirm(`确定删除全部 ${items?.length || 0} 条历史记录？此操作不可撤销。`)) return; setBusy(true); pending.current.forEach((t) => clearTimeout(t)); pending.current.clear(); await api.deleteHistory(); setItems([]); setSel(null); setBusy(false); toast("已清空全部历史记录"); };
  const delAccount = async () => { if (!confirm("确定注销账号？账号和全部历史记录将被永久删除。")) return; setBusy(true); await api.deleteAccount(); signOut(); setBusy(false); };

  if (qid && !sel) return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => router.push("/history/")} className="mb-4"><ArrowLeft />返回列表</Button>
      {selErr ? <Card className="p-8 text-center text-sm text-muted-foreground">{selErr}</Card> : <div className="space-y-3"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /></div>}
    </div>
  );
  if (sel) {
    const input: CheckInput = { title: sel.title, description: sel.description, country: sel.country, platform: sel.platform, category: sel.category };
    return (
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" onClick={back} className="mb-4"><ArrowLeft />返回列表</Button>
        <p className="mb-3 text-xs text-muted-foreground">检查于 {fmtTime(sel.created_at)}{sel.image_count > 0 && ` · 当时上传 ${sel.image_count} 张图片（图片未保存，仅保留识别结果）`} · 规则按当前知识库重新渲染</p>
        <ReportView report={composeReport(input, sel.result)} llm={sel.result} loading={false} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] [&>*]:min-w-0">
      <div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><History className="size-6 text-primary" />历史记录</h1><p className="mt-1 text-sm text-muted-foreground">最近 100 条 AI 预检 · 每个账号最多保留 200 条</p></div>
          {!!items?.length && <Button variant="outline" size="sm" onClick={delAll} disabled={busy}><Trash2 />清空全部</Button>}
        </div>
        {items === null ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px] rounded-2xl" />)}</div>
          : items.length === 0 ? (
            <Card className="grid place-items-center p-12 text-center"><Inbox className="size-8 text-muted-foreground" /><p className="mt-3 font-medium">还没有记录</p><p className="mt-1 text-sm text-muted-foreground">登录后做一次 AI 预检，结果会出现在这里</p><Button asChild className="mt-4" variant="gradient"><Link href="/check/">开始预检</Link></Button></Card>
          ) : (
            <ul className="space-y-2.5">{items.map((it) => (
              <li key={it.id} className="animate-fade-up">
                <Card className="group flex items-center gap-3 p-3.5 transition-all hover:border-primary/30 hover:shadow-md sm:gap-4 sm:p-4">
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4" onClick={() => open(it)}>
                    <Badge tone={RISK_TONE[(it.risk || "待复核") as keyof typeof RISK_TONE] || "neutral"} className="shrink-0 px-2 py-1 text-xs">{it.risk || "—"}风险</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.title || "（仅图片）"}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Flag c={it.country} className="h-2.5 w-3.5" />{COUNTRY_ZH[it.country]}</span>·<span>{PLATFORM_ZH[it.platform]}</span>
                        {it.cat_pred && <>·<span>{CATEGORY_ZH[it.cat_pred]}</span></>}
                        {typeof it.cert_count === "number" && <>·<span className="inline-flex items-center gap-0.5"><BadgeCheck className="size-3" />{it.cert_count ? `${it.cert_count} 项强制认证` : "无强制认证"}</span></>}
                        {it.image_count > 0 && <>·<span className="inline-flex items-center gap-0.5" title="图片未保存，仅保留识别结果"><Camera className="size-3" />含 {it.image_count} 张图片</span></>}
                        <span className="sm:hidden">· {relTime(it.created_at)}</span>
                      </p>
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block" title={fmtTime(it.created_at)}>{relTime(it.created_at)}</span>
                    {selLoading === it.id ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
                  </button>
                  <Button variant="ghost" size="icon" aria-label="删除这条记录" onClick={() => del(it)} className="shrink-0 text-muted-foreground hover:text-red-600"><Trash2 /></Button>
                </Card>
              </li>))}
            </ul>
          )}
      </div>
      <aside className="space-y-4">
        <Card className="p-5 text-sm">
          <p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-emerald-500" />隐私说明</p>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted-foreground">
            <li>· 保存：标题、描述前 300 字、国家/平台/品类、图片数量、AI 结果 JSON、时间。</li>
            <li>· <b className="text-foreground">不保存图片</b>，图片只在本次请求中发给视觉模型。</li>
            <li>· 未登录的纯规则预检完全在浏览器内完成，不上传。</li>
            <li>· 可逐条删除、清空全部，或注销账号（立即删除账号与全部记录）。</li>
          </ul>
        </Card>
        <Card className="p-5 text-sm">
          <p className="font-medium">账号</p>
          <p className="mt-1 truncate text-muted-foreground">{user.email}</p>
          <Button variant="outline" size="sm" className={cn("mt-3 w-full text-red-600 hover:text-red-700")} onClick={delAccount} disabled={busy}><UserX />注销账号并删除数据</Button>
        </Card>
      </aside>
    </div>
  );
}
