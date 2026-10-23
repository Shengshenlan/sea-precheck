/** Small deterministic regression checks for core matching (no network). Run: npm run test:core */
import { buildReport } from "../src/lib/core/match";
import { dryCellOnly, guardLlmSuggestions } from "../src/lib/core/guard";
import { summarize, splitInfo } from "../src/lib/core/verdict";
import type { CheckInput } from "../src/lib/core/types";

let fail = 0;
const ok = (cond: unknown, msg: string) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const ids = (i: CheckInput, ov = {}) => { const r = buildReport(i, ov); return new Set([...r.certs, ...r.customs, ...r.display, ...r.platform].map((h) => h.rule.id)); };
const LI = ["ALL-LIBAT-UN383", "ALL-LIBAT-POWERBANK-UN3480", "ALL-LIBAT-CARRIER", "TH-TISI-BATTERY"];
const noLi = (s: Set<string>) => LI.every((x) => !s.has(x));

// dry-cell toys: no lithium rules
for (const c of ["TH", "PH", "MY"] as const) {
  const s = ids({ title: "儿童电动遥控车 使用4节AA碱性电池", country: c });
  ok(noLi(s), `${c}: AA alkaline RC car → no lithium rules`);
}
ok(noLi(ids({ title: "发光积木玩具 需2节AAA电池（不含）", country: "TH" })), "TH: 2节AAA → no lithium rules");
ok(noLi(ids({ title: "Musical toy drum, uses 3 x AA batteries", country: "PH" })), "PH: 3 x AA batteries → no lithium rules");
ok(noLi(ids({ title: "儿童玩具车 干电池款", country: "MY" }, { features: ["battery"], extraRuleIds: LI })), "MY: 干电池 + LLM extra ids → still none");
// lithium mentioned → rules stay
ok(ids({ title: "遥控车 内置锂电池 遥控器用AA电池", country: "TH" }).has("ALL-LIBAT-UN383"), "TH: 锂电池 + AA → UN38.3 kept");
ok(ids({ title: "儿童电动玩具车 USB充电 500mAh", country: "PH" }).has("ALL-LIBAT-UN383"), "PH: USB充电 500mAh → UN38.3 kept");
ok(ids({ title: "20000mAh 充电宝", country: "TH" }).has("ALL-LIBAT-POWERBANK-UN3480"), "TH: power bank → UN3480 kept");
ok(!dryCellOnly("AAA级品质 毛绒玩具"), "‘AAA级’ is not a battery");
ok(ids({ title: "Extension Cord 4 Gang with USB Ports 3 meters", country: "PH" }).has("PH-BPS-EXTENSION_CORD"), "PH: extension cord (rules only) → BPS extension cord");
ok(ids({ title: "Extension Cord 4 Gang with USB Ports 3 meters", country: "PH" }, { category: "appliance" }).has("PH-BPS-EXTENSION_CORD"), "PH: extension cord, LLM says appliance → still matched");
const g = guardLlmSuggestions("小火车玩具 3节5号电池", ["battery"], ["ALL-LIBAT-UN383"]);
ok(!g.extraRuleIds.length && g.removed.some((x) => x.what === "rule:ALL-LIBAT-UN383"), "guard removes LLM lithium rule for 5号电池");

// platform optional: all platform rules included, headline without platform
const r = buildReport({ title: "Nike 同款运动鞋 玩具", country: "TH" });
ok(r.platform.length >= 2, `no platform → ${r.platform.length} platform rules (all platforms)`);
ok(!/undefined/.test(r.conclusion.headline), "headline has no 'undefined'");
// verdicts
ok(summarize(buildReport({ title: "电饭煲 1.8L", country: "TH" })).verdict === "certs", "电饭煲 TH → 办证后可上架");
ok(summarize(buildReport({ title: "一次性电子烟 vape", country: "TH", category: "appliance" })).verdict === "no", "电子烟 → 不能销售");
const s = summarize(buildReport({ title: "电饭煲 1.8L", country: "MY" }));
ok(s.certs.length >= 1 && s.steps.length <= 3 && s.certs.every((c) => c.name && c.where), "certs have name + where; ≤3 steps");
ok(splitInfo("标题一行\n描述第二行\n第三行").title === "标题一行", "splitInfo first line = title");

console.log(fail ? `\n${fail} failed` : "\nall passed");
process.exit(fail ? 1 : 0);
