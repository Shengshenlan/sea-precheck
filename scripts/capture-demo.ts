/**
 * Capture a REAL check result (local worker + real model) as the static snapshot behind /demo/.
 *   npx tsx scripts/capture-demo.ts [--api http://127.0.0.1:8787]
 * Writes src/data/demo-check.json ({ captured_at, model, info, countries, response }) and a copy in eval/results/.
 * Uses a throw-away local account (DEV_MAIL_LOG); prints no tokens or keys.
 */
import { mkdirSync, writeFileSync } from "node:fs";
const i = process.argv.indexOf("--api"); const API = (i > 0 ? process.argv[i + 1] : "http://127.0.0.1:8787").replace(/\/$/, "");
const INFO = `65W 氮化镓（GaN）快充充电器 双 Type-C + 1 USB-A 三口输出
输入 100-240V ~ 50/60Hz，最大输出 65W，支持 PD3.0 / QC4.0 / PPS 快充协议
标准欧规/美规两脚插头，ABS 阻燃外壳，附 1 米 Type-C 数据线
适用于手机、平板、笔记本电脑`;
const COUNTRIES = ["TH", "MY"];
const call = async (path: string, body: unknown, token?: string) => {
  const r = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, j: (await r.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};
(async () => {
  const email = `demo+${Date.now()}@example.com`;
  let r = await call("/api/auth/send-code", { email, purpose: "register" });
  r = await call("/api/auth/register", { email, code: r.j.dev_code, password: "Passw0rd123" });
  const token = r.j.token as string; if (!token) throw new Error("register failed " + r.status);
  const t0 = Date.now();
  r = await call("/api/check", { info: INFO, countries: COUNTRIES, images: [] }, token);
  if (!r.j.ok) throw new Error("check failed " + r.status + " " + (r.j.message || ""));
  const out = { captured_at: new Date().toISOString(), seconds: +((Date.now() - t0) / 1000).toFixed(1), info: INFO, countries: COUNTRIES, response: r.j };
  delete (out.response as any).quota; delete (out.response as any).check_id; // eslint-disable-line @typescript-eslint/no-explicit-any
  mkdirSync("src/data", { recursive: true });
  writeFileSync("src/data/demo-check.json", JSON.stringify(out, null, 1));
  writeFileSync("eval/results/demo-charger-th-my.json", JSON.stringify(out, null, 1));
  console.log("saved; model", r.j.model, "secs", out.seconds, COUNTRIES.map((c) => `${c}:${r.j.results?.[c]?.ok}`).join(" "));
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
