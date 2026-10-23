"use client";
import { useMemo, useRef, useState } from "react";
import { buildReport, CATEGORY_ZH, COUNTRY_ZH, PLATFORM_ZH, MAX_DESC, MAX_TITLE } from "@/lib/core/match";
import { validateNote } from "@/lib/core/validate";
import { candidateRules } from "@/lib/core/match";
import type { Category, CheckInput, Country, Platform, Report } from "@/lib/core/types";
import { API_URL, fetchLlm, type LlmResult } from "@/lib/api";
import { RuleCard } from "./RuleCard";

const EXAMPLES: { label: string; input: CheckInput }[] = [
  { label: "泰国 · 蓝牙空气炸锅", input: { title: "智能空气炸锅 5L 家用 可视窗口 蓝牙APP控制 小米同款", description: "1400W 220V，带 APP 远程控制", category: "auto", country: "TH", platform: "tiktok" } },
  { label: "马来西亚 · 65W 氮化镓充电器", input: { title: "65W 氮化镓快充充电器 PD 三口 适用于 iPhone/Samsung", description: "英规插头 Type-C 输出", category: "auto", country: "MY", platform: "shopee" } },
  { label: "菲律宾 · 美白面霜", input: { title: "烟酰胺美白祛斑面霜 50g 平替大牌", description: "淡斑提亮 7 天见效", category: "auto", country: "PH", platform: "lazada" } },
];

const RISK_CLS: Record<Report["risk"]["level"], string> = { 高: "bg-red-600", 中: "bg-amber-500", 低: "bg-emerald-600", 待复核: "bg-neutral-500" };

function Section({ title, hint, children, empty }: { title: string; hint?: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <section className="mt-5">
      <h3 className="text-base font-bold text-neutral-900">{title}</h3>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      <div className="mt-2 space-y-2.5">{empty ? <p className="text-sm text-neutral-500">知识库中未匹配到相关条目（不代表不需要，请人工复核）。</p> : children}</div>
    </section>
  );
}

export default function Checker() {
  const [input, setInput] = useState<CheckInput>({ title: "", description: "", category: "auto", country: "TH", platform: "shopee" });
  const [submitted, setSubmitted] = useState<CheckInput | null>(null);
  const [llm, setLlm] = useState<LlmResult | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const report = useMemo<Report | null>(() => {
    if (!submitted) return null;
    if (!llm || !llm.ok) return buildReport(submitted);
    const base = buildReport(submitted, { category: llm.category ?? undefined, features: llm.features, items: llm.items, extraRuleIds: llm.extra_rule_ids });
    const allowed = new Set(candidateRules(submitted.country, base.category).map((r) => r.id));
    const notes = llm.notes.map((n) => validateNote(n, allowed)); // re-validate client-side (defense in depth)
    return { ...base, llm: { model: llm.model, summary: llm.summary, notes, extra_rule_ids: llm.extra_rule_ids, latency_ms: llm.latency_ms, dropped: llm.dropped } };
  }, [submitted, llm]);

  async function run(i: CheckInput) {
    if (!i.title.trim()) return;
    abortRef.current?.abort();
    const ctl = new AbortController(); abortRef.current = ctl;
    setSubmitted({ ...i }); setLlm(null);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    if (!API_URL) { setLlm({ ok: false, reason: "disabled", message: "本站未配置 AI 后端，以下为纯规则结果（全部在你的浏览器内计算，不上传任何数据）。" }); return; }
    setLoading(true);
    const r = await fetchLlm(i, ctl.signal);
    if (!ctl.signal.aborted) { setLlm(r); setLoading(false); }
  }

  const set = <K extends keyof CheckInput>(k: K, v: CheckInput[K]) => setInput((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <form className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5" onSubmit={(e) => { e.preventDefault(); run(input); }}>
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="self-center text-xs text-neutral-500">一键示例：</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-800 hover:bg-blue-100"
              onClick={() => { setInput(ex.input); run(ex.input); }}>{ex.label}</button>
          ))}
        </div>
        <label className="block text-sm font-medium">商品标题 <span className="text-red-600">*</span></label>
        <input className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-base" maxLength={MAX_TITLE} required value={input.title}
          placeholder="例如：家用迷你电饭煲 1.2L 智能预约" onChange={(e) => set("title", e.target.value)} />
        <label className="mt-3 block text-sm font-medium">商品描述（可选）</label>
        <textarea className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-base" rows={3} maxLength={MAX_DESC} value={input.description}
          placeholder="功率、电压、是否带蓝牙/电池、适用年龄、成分等" onChange={(e) => set("description", e.target.value)} />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">目标国家
            <select className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2" value={input.country} onChange={(e) => set("country", e.target.value as Country)}>
              {(["TH", "PH", "MY"] as const).map((c) => <option key={c} value={c}>{COUNTRY_ZH[c]}</option>)}
            </select></label>
          <label className="text-sm font-medium">平台
            <select className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2" value={input.platform} onChange={(e) => set("platform", e.target.value as Platform)}>
              {(["tiktok", "shopee", "lazada"] as const).map((c) => <option key={c} value={c}>{PLATFORM_ZH[c]}</option>)}
            </select></label>
          <label className="text-sm font-medium">品类
            <select className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2" value={input.category} onChange={(e) => set("category", e.target.value as Category | "auto")}>
              <option value="auto">自动识别</option>
              {(Object.keys(CATEGORY_ZH) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_ZH[c]}</option>)}
            </select></label>
        </div>
        <button className="mt-4 w-full rounded-lg bg-blue-700 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:opacity-50" disabled={!input.title.trim()}>开始预检</button>
        <p className="mt-2 text-center text-xs text-neutral-500">规则匹配在浏览器本地完成；{API_URL ? "AI 补充分析会把标题和描述发到后端调用大模型，不保存。" : "本站未开启 AI 分析。"}</p>
      </form>

      <div ref={resultRef} className="scroll-mt-4">
        {report && <ReportView report={report} llm={llm} loading={loading} />}
      </div>
    </div>
  );
}

function ReportView({ report: r, llm, loading }: { report: Report; llm: LlmResult | null; loading: boolean }) {
  const reviewCount = r.review.length + (r.llm?.notes.filter((n) => n.status !== "verified").length || 0);
  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-lg px-3 py-1.5 text-lg font-bold text-white ${RISK_CLS[r.risk.level]}`}>风险：{r.risk.level}</span>
        <div className="text-sm text-neutral-700">
          {COUNTRY_ZH[r.input.country]} · {PLATFORM_ZH[r.input.platform]} · {r.category ? CATEGORY_ZH[r.category] : "未识别品类"}
          <span className="text-neutral-400">（{({ user: "手动选择", auto: "关键词识别", llm: "AI 识别", none: "—" })[r.category_source]}）</span>
        </div>
      </div>
      <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700">{r.risk.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>

      <div className="mt-3 rounded-lg bg-neutral-50 p-2.5 text-sm">
        {loading && <p className="animate-pulse text-blue-700">AI 正在补充分析（约 5–30 秒）……下方规则结果已可查看。</p>}
        {!loading && llm && !llm.ok && <p className="text-neutral-600">{llm.message}</p>}
        {!loading && r.llm && (
          <div>
            <p className="font-medium">AI 补充说明 <span className="text-xs font-normal text-neutral-500">（{r.llm.model}，{(r.llm.latency_ms / 1000).toFixed(1)}s；AI 不能新增知识库外的规则，引用原文已逐字校验）</span></p>
            <p className="mt-1 text-neutral-700">{r.llm.summary}</p>
            {r.llm.notes.length > 0 && <ul className="mt-1.5 space-y-1.5">
              {r.llm.notes.map((n, i) => (
                <li key={i} className={`rounded border p-2 ${n.status === "verified" ? "border-emerald-200" : "border-amber-300 bg-amber-50"}`}>
                  <span className="font-mono text-xs">{n.rule_id}</span> {n.status !== "verified" && <span className="rounded bg-amber-500 px-1 text-xs text-white">待人工复核：{n.problem}</span>}
                  <p>{n.explanation}</p>
                  {n.status === "verified" && <p className="mt-0.5 text-xs text-neutral-500">原文：“{n.quote}”</p>}
                </li>))}
            </ul>}
            {r.llm.dropped > 0 && <p className="mt-1 text-xs text-neutral-500">已丢弃 {r.llm.dropped} 条无法在知识库中核对的模型输出。</p>}
          </div>)}
      </div>

      <Section title="① 需要的认证 / 许可 / 通报" hint="强制 = 未取得即上架属违规；待人工复核 = 知识库无法确定" empty={!r.certs.length}>
        {r.certs.map((h) => <RuleCard key={h.rule.id} hit={h} />)}
      </Section>
      <Section title="② 平台禁限售规则命中" empty={!r.platform.length}>
        {r.platform.map((h) => <RuleCard key={h.rule.id} hit={h} />)}
      </Section>
      <Section title="③ listing 展示义务与违规后果" empty={!r.display.length}>
        {r.display.map((h) => <RuleCard key={h.rule.id} hit={h} />)}
      </Section>
      <Section title="④ 商标 / 品牌词风险" hint="只做词表提醒，不能证明“不侵权”。">
        {r.brand.hits.length ? (
          <ul className="space-y-1 text-sm">{r.brand.hits.map((h, i) => (
            <li key={i} className="rounded border border-neutral-200 p-2">
              <b>“{h.term}”</b>{" "}
              {({ brand: `疑似他人品牌：${h.brand}。无授权使用可能构成商标侵权，平台可直接下架。`, counterfeit: "仿冒暗示词，平台通常按假货处理。", compat: `兼容性描述（${h.brand}）。只能如实说明兼容，不要放在标题开头、不要用对方 logo。`, dupe: "“平替/dupe”类表述会把他人品牌和你的商品关联，容易被投诉。" })[h.type]}
            </li>))}</ul>
        ) : <p className="text-sm text-neutral-600">词表中未命中品牌词或仿冒暗示词。<b>这不代表没有侵权风险</b>（外观设计、图片版权、未收录品牌都可能被投诉）。</p>}
        <p className="mt-2 text-sm">请自行检索：</p>
        <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">{r.brand.links.map((l) => <li key={l.url}><a className="text-blue-700 underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.name}</a></li>)}</ul>
      </Section>
      {r.customs.length > 0 && <Section title="税费 / 清关提示">{r.customs.map((h) => <RuleCard key={h.rule.id} hit={h} compact />)}</Section>}
      <Section title={`⑤ 下一步（${reviewCount} 项待人工复核）`}>
        <ol className="list-decimal space-y-1 pl-5 text-sm">{r.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        {r.review.length > 0 && <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-sm">
          <p className="font-medium text-amber-900">待人工复核</p>
          <ul className="mt-1 list-disc pl-5">{r.review.map((x, i) => <li key={i}>{x.text} —— <span className="text-neutral-600">{x.reason}</span></li>)}</ul>
        </div>}
      </Section>
      <details className="mt-5 text-sm">
        <summary className="cursor-pointer font-medium">如果也要卖印尼 / 越南（仅提示，未做完整检查）</summary>
        <div className="mt-2 space-y-2.5">{r.other_markets.map((h) => <RuleCard key={h.rule.id} hit={h} compact />)}</div>
      </details>
      <p className="mt-4 text-xs text-neutral-500">知识库版本 {r.kb_version}。结果仅供自查，不是法律意见。</p>
    </div>
  );
}
