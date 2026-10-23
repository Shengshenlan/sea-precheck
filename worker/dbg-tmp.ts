import { runFetch, runPi } from "./src/agent";
import { extractJson, postProcess } from "./src/parse";
import { sanitizeInput } from "../src/lib/core/match";
const S = [{ title: "Air Fryer 5L 1500W Digital", country: "TH", platform: "shopee" },{ title: "Hair Dryer 2000W Negative Ion", country: "PH", platform: "lazada" },{ title: "15W 磁吸无线充电器 MagSafe", country: "MY", platform: "tiktok" }];
for (const th of ["off", "low"] as const) for (const impl of [runFetch]) for (const s of S) {
  const inp = sanitizeInput({ ...s, category: "auto" } as any); const t = Date.now();
  try { const r = await impl(inp, { baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4", model: "glm-5.3-flash", apiKey: process.env.ZHIPU_CODING_PLAN_KEY!, timeoutMs: 60000, signal: AbortSignal.timeout(60000), thinking: th });
    const o: any = postProcess(inp, extractJson(r.text));
    console.log(th, s.title.slice(0,18), Date.now()-t, "ms tools", r.toolCalls.length, "feat", o.features, "notes", o.notes.length, "verified", o.notes.filter((n:any)=>n.verified).length, "dropped", o.dropped ?? o.notes_dropped);
  } catch (e: any) { console.log(th, s.title, "ERR", e.code, e.message); }
}
