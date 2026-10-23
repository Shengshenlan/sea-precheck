import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Baby, BatteryCharging, Camera, CheckCircle2, ChevronDown, FileSearch, FileText, Lock, Microwave,
  Quote, Radar, ScanSearch, ShieldAlert, ShieldQuestion, Sparkles, SprayCan, TriangleAlert,
  ShieldCheck,
} from "lucide-react";
import { buildReport, COUNTRY_ZH } from "@/lib/core/match";
import { kb } from "@/lib/core/kb";
import { DISCLAIMER, DISCLAIMER_TITLE } from "@/lib/core/disclaimer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flag } from "@/components/site/Flag";
import { RuleCard } from "@/components/checker/RuleCard";

const SAMPLE = buildReport({ title: "智能空气炸锅 5L 家用 可视窗口 蓝牙APP控制 小米同款", description: "1400W 220V，带 APP 远程控制", category: "auto", country: "TH", platform: "tiktok" });
const countRules = (c: string) => kb.rules.filter((r) => r.country === c).length;

export default function Home() {
  const verified = kb.rules.filter((r) => r.excerpts.some((e) => e.verification !== "paraphrase")).length;
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/20 via-violet-400/15 to-cyan-400/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-4 pb-14 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-20 lg:pt-24">
          <div className="animate-fade-up">
            <Link href="/sources/" className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />知识库 {kb.version} · {kb.rules.length} 条规则，{verified} 条附可核对原文<ArrowRight className="size-3" />
            </Link>
            <h1 className="mt-6 text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.5rem]">上架东南亚之前，<br /><span className="text-gradient">先扫一遍合规雷达</span></h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">适用于<b className="font-semibold text-foreground">小家电、充电器 / 充电宝、玩具、美妆</b>。输入商品标题或上传包装图，30 秒看清在泰国、菲律宾、马来西亚的 TikTok Shop / Shopee / Lazada 需要哪些认证、会踩哪些平台规则、listing 要写什么、有没有品牌词风险。</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-emerald-500" />规则检查无需登录，直接在浏览器内完成；AI 分析与图片识别需登录。</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="gradient"><Link href="/check/"><Radar />开始预检</Link></Button>
              <Button asChild size="lg" variant="outline"><a href="#sample"><FileSearch />看示例报告</a></Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {["TH", "PH", "MY"].map((c) => <span key={c} className="inline-flex items-center gap-1.5"><Flag c={c} />{COUNTRY_ZH[c as "TH"]}</span>)}
              <span className="h-4 w-px bg-border" /><span>每条结论附官方原文</span>
            </div>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* Authorities & facts */}
      <section className="relative border-t bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">知识库引用的主管机构与平台政策</p>
              <div className="mt-4 flex flex-wrap gap-x-7 gap-y-3 text-[15px] font-semibold tracking-tight text-foreground/55">
                {["TISI", "NBTC", "Thai FDA", "BPS", "NTC", "FDA Philippines", "SIRIM", "Energy Commission", "MCMC", "NPRA", "TikTok Shop", "Shopee", "Lazada"].map((a) => <span key={a}>{a}</span>)}
              </div>
            </div>
            <dl className="grid grid-cols-3 divide-x rounded-2xl border bg-card text-center shadow-sm">
              {[[String(kb.rules.length), "条规则"], [String(kb.rules.reduce((n, r) => n + r.excerpts.length, 0)), "段原文摘录"], ["3", "个市场"]].map(([n, l]) => (
                <div key={l} className="px-6 py-4"><dt className="sr-only">{l}</dt><dd className="text-2xl font-bold tabular-nums tracking-tight">{n}</dd><p className="mt-0.5 text-xs text-muted-foreground">{l}</p></div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="三步完成" title="从商品信息到上架清单" />
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              [ScanSearch, "输入商品", "标题、描述，可选上传最多 3 张商品 / 包装图；选择国家与平台。"],
              [Sparkles, "规则 + AI 双重匹配", "本地规则引擎先出结果；登录后 AI 读懂隐含信息、识别图片标志，引用原文逐字校验。"],
              [CheckCircle2, "拿到可执行清单", "认证、平台规则、展示义务、品牌词风险和下一步，每条附主管机构与官方链接。"],
            ].map(([I, t, d], i) => {
              const Icon = I as typeof Radar;
              return (
                <li key={i} className="group relative rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
                  <span className="absolute right-5 top-4 text-5xl font-bold text-muted/80 dark:text-muted">{i + 1}</span>
                  <span className="relative grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-500/25"><Icon className="size-5" /></span>
                  <h3 className="relative mt-4 font-semibold">{t as string}</h3>
                  <p className="relative mt-1.5 text-sm leading-relaxed text-muted-foreground">{d as string}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Markets & categories */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow="覆盖范围" title="三个市场 · 四大品类" desc="印尼、越南仅做提示，不做完整检查。" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { c: "TH", certs: "TISI（มอก.）· NBTC · 泰国 FDA", note: "电器强制标准、无线设备、化妆品通报" },
            { c: "PH", certs: "BPS（PS/ICC）· NTC · FDA Philippines", note: "产品标准认证、无线型号批准、化妆品通报" },
            { c: "MY", certs: "SIRIM · ST（能源委员会）· MCMC · NPRA", note: "电气设备认证、无线设备、化妆品通报" },
          ].map((m) => (
            <Card key={m.c} className="p-5 transition-all hover:border-primary/30">
              <div className="flex items-center gap-3"><Flag c={m.c} className="h-6 w-9" /><div><p className="font-semibold">{COUNTRY_ZH[m.c as "TH"]}</p><p className="text-xs text-muted-foreground">{countRules(m.c)} 条规则</p></div></div>
              <p className="mt-4 text-sm font-medium">{m.certs}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.note}</p>
            </Card>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[[Microwave, "小家电", "电饭煲、空气炸锅、吹风机…"], [BatteryCharging, "充电 / 电源", "充电器、适配器、移动电源"], [Baby, "玩具", "电动、遥控、儿童用品"], [SprayCan, "化妆品", "护肤、彩妆、美白宣称"]].map(([I, t, d]) => {
            const Icon = I as typeof Radar;
            return <Card key={t as string} className="flex items-center gap-3 p-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Icon className="size-5" /></span><div className="min-w-0"><p className="text-sm font-semibold">{t as string}</p><p className="truncate text-xs text-muted-foreground">{d as string}</p></div></Card>;
          })}
        </div>
      </section>

      {/* Sample report */}
      <section id="sample" className="scroll-mt-20 border-y bg-card/50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:items-start [&>*]:min-w-0">
          <div className="lg:sticky lg:top-24">
            <SectionHead align="left" eyebrow="示例报告" title="每条结论都能追溯到原文" desc="下面是“泰国 · TikTok Shop · 蓝牙空气炸锅”的真实规则匹配结果（纯规则，未用 AI）。展开即可看到官方原文摘录、来源链接和抓取日期。" />
            <ul className="mt-6 space-y-2.5 text-sm">
              {[[BadgeCheck, "认证要求附主管机构与官方链接"], [Quote, "原文逐字摘录，转述内容明确标注"], [ShieldQuestion, "无法确定的内容标为“待复核”"], [Camera, "登录后可识别包装图上的认证标志"]].map(([I, t]) => {
                const Icon = I as typeof Radar;
                return <li key={t as string} className="flex items-center gap-2.5"><Icon className="size-4 text-primary" />{t as string}</li>;
              })}
            </ul>
            <Button asChild className="mt-8" variant="gradient"><Link href="/check/">用我的商品试试<ArrowRight /></Link></Button>
          </div>
          <div className="space-y-3">
            <Card className="flex items-center gap-3 p-4">
              <span className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 px-3 py-1.5 text-sm font-bold text-white shadow-md shadow-red-500/25"><ShieldAlert className="size-4" />{SAMPLE.risk.level}风险</span>
              <div className="min-w-0 text-sm"><p className="truncate font-medium">{SAMPLE.input.title}</p><p className="text-xs text-muted-foreground">{SAMPLE.certs.length} 项认证 · {SAMPLE.platform.length} 条平台规则 · {SAMPLE.display.length} 项展示义务 · {SAMPLE.brand.hits.length} 个品牌词</p></div>
            </Card>
            {SAMPLE.certs.slice(0, 2).map((h) => <RuleCard key={h.rule.id} hit={h} />)}
            {SAMPLE.brand.hits.length > 0 && <Card className="flex items-start gap-3 p-4 text-sm"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" /><div><p className="font-medium">品牌词：“{SAMPLE.brand.hits[0].term}”</p><p className="mt-0.5 text-muted-foreground">疑似他人品牌（{SAMPLE.brand.hits[0].brand}），无授权使用可能构成商标侵权，平台可直接下架。</p></div></Card>}
          </div>
        </div>
      </section>

      {/* Disclaimer + FAQ */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Card className="border-amber-300/70 bg-amber-50/50 p-6 dark:border-amber-500/30 dark:bg-amber-500/5">
          <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300"><TriangleAlert className="size-5" />{DISCLAIMER_TITLE}</p>
          <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-amber-950/80 dark:text-amber-100/80 md:grid-cols-2">{DISCLAIMER.map((d, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-amber-500" />{d}</li>)}</ul>
        </Card>
        <div className="mt-16"><SectionHead eyebrow="常见问题" title="FAQ" /></div>
        <div className="mx-auto mt-8 max-w-3xl divide-y rounded-2xl border bg-card">
          {[
            ["结果可以直接作为合规依据吗？", "不可以。本工具是基于公开法规原文的关键词匹配与摘录，用于上架前自查，不构成法律、认证或税务意见。请以主管机构官方信息和检测机构意见为准。"],
            ["AI 会不会编造法规？", "AI 只能从知识库已有规则中选择，不能新增规则；它引用的每段原文都会在服务端和浏览器端两次逐字校验，对不上的会被丢弃或标为“待复核”。没有明确证据（如“蓝牙”“无线充”）的功能推断也会被拦截。"],
            ["为什么要登录？", "AI 分析和图片识别需要调用大模型，有成本，登录用于每日限额（每人每天 20 次）和防滥用。不登录也可以使用完整的规则预检，且全部在浏览器本地完成。"],
            ["上传的图片会被保存吗？", "不会。图片在浏览器内压缩后仅随本次请求发送给视觉模型，用于提取认证标志、品牌、电池/无线等信息。历史记录只保存文字摘要和结果。"],
            ["包装上有 TISI / SIRIM 标志就说明合规了吗？", "不一定。标志可能被冒用或证书已过期，请向供应商索取证书编号，并在官方数据库核验。"],
            ["法规多久更新一次？", "知识库按版本维护，每条摘录都标注了抓取日期。东南亚法规变化很快，请务必点开官方链接确认最新版本。"],
          ].map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">{q}<ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-cyan-600 px-6 py-12 text-center text-white shadow-xl shadow-indigo-500/20 sm:px-12">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
          <h2 className="relative text-2xl font-bold sm:text-3xl">下一款新品，上架前先扫一下</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-sm text-white/80">规则预检无需登录，数据不离开浏览器；AI 分析与图片识别需登录账号。</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-indigo-700 shadow-lg hover:bg-white/90"><Link href="/check/"><Radar />开始预检</Link></Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10"><Link href="/login/"><Lock />注册账号</Link></Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHead({ eyebrow, title, desc, align = "center" }: { eyebrow: string; title: string; desc?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {desc && <p className={`mt-3 text-sm leading-relaxed text-muted-foreground ${align === "center" ? "mx-auto max-w-xl" : "max-w-md"}`}>{desc}</p>}
    </div>
  );
}

function HeroMock() {
  return (
    <div className="relative animate-fade-up [animation-delay:120ms]">
      <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-br from-indigo-500/20 to-cyan-400/20 blur-2xl" />
      <Card className="relative overflow-hidden rounded-2xl shadow-2xl shadow-indigo-500/10">
        <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-red-400" /><span className="size-2.5 rounded-full bg-amber-400" /><span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 flex-1 truncate rounded-md bg-card px-2 py-0.5 text-center text-[11px] text-muted-foreground">出海合规雷达 / 预检报告</span>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 px-2.5 py-1.5 text-sm font-bold text-white shadow-md shadow-red-500/25"><ShieldAlert className="size-4" />高风险</span>
            <div className="min-w-0 text-xs"><p className="truncate text-sm font-semibold">磁吸无线充电宝 10000mAh</p><p className="flex items-center gap-1 text-muted-foreground"><Flag c="MY" className="h-2.5 w-3.5" />马来西亚 · Shopee · 充电/电源</p></div>
          </div>
          <div className="rounded-xl border bg-gradient-to-r from-indigo-500/[0.06] to-cyan-500/[0.05] p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium"><Camera className="size-3.5 text-primary" />图片识别</p>
            <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone="green">SIRIM</Badge><Badge tone="blue">无线充电</Badge><Badge tone="blue">锂电池</Badge><Badge>英文 / 中文标签</Badge></div>
          </div>
          {[["SIRIM 认证 + ST COA", "Suruhanjaya Tenaga · 强制", "red"], ["MCMC 无线设备型号认证", "MCMC · 强制", "red"], ["Shopee 锂电池运输限制", "平台规则 · 已命中", "sky"]].map(([t, s, tone]) => (
            <div key={t} className="flex items-center gap-3 rounded-xl border p-3">
              <BadgeCheck className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{t}</p><p className="text-[11px] text-muted-foreground">{s}</p></div>
              <Badge tone={tone as "red"}>{tone === "red" ? "强制" : "平台"}</Badge>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-xl border border-dashed p-3 text-[11px] text-muted-foreground"><FileText className="size-3.5" />官方原文摘录 · 抓取于 2026-10 · 3 段</div>
        </div>
      </Card>
    </div>
  );
}
