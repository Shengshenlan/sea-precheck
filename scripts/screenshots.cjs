/**
 * Headless screenshots of the real UI flow (register via dev code → submit → result → history), desktop + mobile.
 * Needs: static site on :3000 (npm run serve), local worker on :8787 with DEV_MAIL_LOG=1, Chrome, and playwright-core:
 *   npm i --no-save playwright-core && node scripts/screenshots.cjs
 */
const { chromium } = require("playwright-core");
const WEB = process.env.WEB || "http://127.0.0.1:3000";
const IMGS = (process.env.IMG || "/workspace/pack.jpg,eval/images/img-th-kettle.jpg,eval/images/img-ph-cream.jpg,eval/images/img-my-vacuum.jpg,eval/images/img-th-hairdryer.jpg").split(","); // up to 5 per check
const OUT = "docs/screenshots";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--lang=zh-CN"] });
  const vp = { desktop: { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 2 }, mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
  // let entrance animations finish and toasts disappear, start from the top
  const settle = async (p) => { await p.waitForTimeout(700); await p.waitForFunction(() => !document.querySelector('[aria-live="polite"] [role="status"]'), null, { timeout: 9000 }).catch(() => {}); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200); };
  const shot = (p, name, full = false) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }).then(() => console.log(`saved ${OUT}/${name}.png`));

  // ---- desktop: full flow ----
  const ctx = await browser.newContext({ ...vp.desktop, locale: "zh-CN", colorScheme: "light" });
  const p = await ctx.newPage();
  await p.goto(WEB + "/"); await p.getByRole("button", { name: "登录", exact: true }).waitFor();
  await settle(p); await shot(p, "desktop-login");
  await p.getByRole("button", { name: "注册", exact: true }).click();
  await p.fill("#email", `demo+${Date.now()}@example.com`);
  await p.getByRole("button", { name: "发送验证码" }).click();
  const code = (await p.getByTestId("dev-code").innerText()).match(/\d{6}/)[0];
  await p.fill("#code", code); await p.fill("#password", "Passw0rd123");
  await shot(p, "desktop-register-code");
  await p.getByRole("button", { name: "注册并登录" }).click();
  await p.getByRole("button", { name: "开始检查" }).waitFor();
  await p.locator("textarea").fill("儿童电动遥控玩具车 3岁以上\n使用 4 节 AA 碱性干电池，ABS 塑料材质，带灯光音效");
  await p.locator('input[type="file"]').setInputFiles(IMGS);
  for (const n of ["菲律宾", "马来西亚"]) await p.getByRole("button", { name: n }).click();
  await settle(p);
  await shot(p, "desktop-submit");
  await p.getByRole("button", { name: "开始检查" }).click();
  await p.getByTestId("progress").waitFor(); await p.waitForTimeout(3000);
  await shot(p, "desktop-progress");
  await p.getByTestId("result").waitFor({ timeout: 120000 }); await settle(p);
  await shot(p, "desktop-result", true);
  await p.locator("details summary").first().click(); await p.waitForTimeout(300);
  await p.locator("details summary").first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
  await p.waitForTimeout(200);
  await shot(p, "desktop-result-details");
  await p.getByTestId("avatar").click(); await p.waitForTimeout(200);
  await shot(p, "desktop-avatar-menu");
  await p.getByRole("menuitem", { name: "历史记录" }).click();
  await p.getByTestId("history-list").waitFor(); await settle(p);
  await shot(p, "desktop-history");
  const token = await p.evaluate(() => Object.fromEntries(Object.entries(localStorage)));

  // ---- mobile: same account (localStorage copied), result opened from history (no second AI run) ----
  const m = await browser.newContext({ ...vp.mobile, locale: "zh-CN", colorScheme: "light" });
  const mp = await m.newPage();
  await mp.goto(WEB + "/"); await mp.getByRole("button", { name: "登录", exact: true }).waitFor();
  await settle(mp); await shot(mp, "mobile-login");
  await mp.evaluate((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, token);
  await mp.reload(); await mp.getByRole("button", { name: "开始检查" }).waitFor();
  await mp.locator("textarea").fill("儿童电动遥控玩具车 3岁以上\n使用 4 节 AA 碱性干电池");
  await mp.locator('input[type="file"]').setInputFiles(IMGS);
  await mp.getByRole("button", { name: "菲律宾" }).click(); await settle(mp);
  await shot(mp, "mobile-submit", true);
  await mp.goto(WEB + "/history/"); await mp.getByTestId("history-list").waitFor(); await settle(mp);
  await shot(mp, "mobile-history");
  await mp.getByTestId("history-list").locator("button").first().click(); await mp.getByTestId("result").waitFor();
  await settle(mp);
  await shot(mp, "mobile-result", true);
  await mp.getByTestId("avatar").click(); await mp.waitForTimeout(200);
  await shot(mp, "mobile-avatar-menu");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
