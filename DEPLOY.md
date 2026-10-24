# 部署说明（GitHub Pages + Cloudflare Workers + D1）

架构：
- **前端**：Next.js 静态导出（`output: "export"`），托管在 GitHub Pages。首页是登录卡片，登录后是检查工作区；知识库（kb/rules.json）与确定性匹配打包在前端，用于按国家合并并再校验 AI 结果。
- **后端**：`worker/` 目录，Cloudflare Worker：邮箱验证码注册/登录/重置密码、`POST /api/check`（多国家）、历史记录、`GET /api/health`。
- **账号与历史**：Cloudflare D1（binding `DB`），表 users / checks / usage / reg_ip / email_codes / mail_counters / daily_counters / inflight，见 `worker/migrations/`（0001、0002、0003 三个迁移）。
- **邮件**：Brevo 事务邮件 API 发送验证码。
- **密钥**：`ZHIPUAI_API_KEY`、`JWT_SECRET`、`BREVO_API_KEY` 只作为 Worker secret 存在。不进 git、不进日志、不进前端 bundle。

> 当前状态：Worker 已部署到 https://sea-precheck-api.sea-precheck.workers.dev（D1 迁移 0001–0003 已应用，secrets 已设置），GitHub Actions 变量 `API_URL` 已指向它，Pages 前端已连接（未配置 `API_URL` 时页面才显示“服务暂未开放”）。

## 1. Cloudflare Worker

```bash
cd worker
npm ci                                   # wrangler 4.x 需要 Node >= 22
npx wrangler login                       # 浏览器登录 Cloudflare 账号
npx wrangler secret put ZHIPUAI_API_KEY  # 交互式粘贴，不会写入文件
npx wrangler secret put JWT_SECRET       # 随机 ≥32 字节，例如 openssl rand -base64 48 的输出；轮换会使所有登录失效、未用的验证码作废
npx wrangler secret put BREVO_API_KEY    # 见下方“邮件（Brevo）”；不设置则无法注册/重置密码
npx wrangler d1 create sea-precheck      # 把输出的 database_id 填进 wrangler.toml 的 [[d1_databases]]（当前是占位 0000…）
npx wrangler d1 migrations apply sea-precheck --remote   # 应用 0001_init + 0002_email_codes + 0003_limits；已部署过旧版本的只会补缺的迁移
# 编辑 wrangler.toml 的 [vars]：
#   ALLOWED_ORIGINS = "https://<user>.github.io"        # 只写 origin，不带路径；多个用逗号分隔
#   LLM_BASE_URL    = "https://open.bigmodel.cn/api/coding/paas/v4"  # Coding Plan；按量付费用 /api/paas/v4
#   LLM_MODEL       = "glm-5.3-flash"                   # 已验证可用（备选 glm-4.5-flash，走 /api/paas/v4）
#   LLM_THINKING    = "off"                             # off|low|high；开启后更慢，max_tokens 自动加到 6000
#   AGENT_IMPL      = "fetch"（默认，Free 计划推荐）或 "pi"   # 见下文 CPU 说明
#   VISION_BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4"  # 图片识别端点
#   VISION_MODEL    = "glm-5.3-flash"                     # 两个端点探测结果见 eval/results/vision-probe.md
#   用量上限（CHECKS_* / MAIL_* / REG_* / MAX_* / INFO_MAX_CHARS / VISION_TIMEOUT_MS）见下方“用量上限”表
#   PBKDF2_ITERATIONS  = "100000"                       # workerd 上限 100000；Free 计划 CPU 紧张时可调低（旧哈希自带迭代数，仍可校验）
#   MAIL_FROM       = "zhu05361@gmail.com"              # 必须是 Brevo 中已验证的发件人
#   MAIL_FROM_NAME  = "出海合规雷达"
#   不要在线上设置 DEV_MAIL_LOG（它只在本地无 BREVO_API_KEY 时把验证码打印到控制台）
npx wrangler deploy
curl https://sea-precheck-api.<sub>.workers.dev/api/health
```

### 邮件（Brevo）

1. 注册 Brevo 账号：https://www.brevo.com/ （免费套餐每天 300 封，足够验证码使用）。
2. 验证发件人：Brevo 后台 → **Senders, Domains & Dedicated IPs → Senders → Add a sender**，填写 `zhu05361@gmail.com` 和发件人名称“出海合规雷达”，到该 Gmail 邮箱点击确认链接。
3. 创建 API key：右上角账号 → **SMTP & API → API Keys → Generate a new API key**（是 `xkeysib-` 开头的 API key，不是 SMTP 密码）。新账号可能需要先完成账号资料审核才能发送事务邮件。
4. `cd worker && npx wrangler secret put BREVO_API_KEY`，粘贴 key（不会写入文件）。
5. 确认 `wrangler.toml` 的 `MAIL_FROM` 与已验证发件人一致；`npx wrangler d1 migrations apply sea-precheck --remote` 应用 `0002_email_codes.sql`；`npx wrangler deploy`。
6. 自测：在线上页面注册一个自己的邮箱。收不到时看 `npx wrangler tail`：`mail_error` 带 Brevo 的 HTTP 状态（401 = key 错误，400 = 发件人未验证）；`mail_not_configured` = 没有设置 `BREVO_API_KEY`。

**送达率提醒**：用 `@gmail.com` 作为发件人、却经由 Brevo 的服务器发出，不符合 gmail.com 的 DMARC 对齐要求，Gmail / Outlook 等收件方可能把验证码放进垃圾邮件，个别收件服务器可能直接拒收（Brevo 也会为此提示改写发件地址）。正式上线建议换成自有域名发件（如 `no-reply@yourdomain.com`），在 Brevo 中验证域名并按提示添加 SPF / DKIM / DMARC 记录，然后只改 `MAIL_FROM` 即可。页面已提示“收不到请检查垃圾邮件”。

`ratelimits` 里的 `namespace_id`（1001/1002/1003，`RL_AUTH` 为登录/注册每 IP 每分钟 6 次）是账号内自选的整数，部署时保证不与其他 Worker 冲突即可。

### 用量上限（保护智谱 Coding Plan 额度）

所有数值都在 `worker/wrangler.toml` 的 `[vars]` 中（字符串形式的整数），代码里的默认值与下表一致；变量缺失或非法时回退到默认值。

| 上限 | 默认 | 变量 / 配置位置 | 实现 | 超限返回 |
|---|---|---|---|---|
| 每账号每日检查 | 10 次 | `CHECKS_PER_USER_PER_DAY`（旧名 `DAILY_AI_QUOTA` 仍兼容） | D1 `usage`，原子条件自增 | 429 `user_quota`「今日检查次数已用完（每天 N 次），请明天再来」 |
| 每 IP 每日检查 | 20 次 | `CHECKS_PER_IP_PER_DAY` | D1 `daily_counters`（key 为 IP 的 HMAC，不存明文） | 429 `ip_quota`「当前网络今日检查次数已达上限，请明天再来」 |
| 每 IP 每分钟检查 | 3 次 | `[[ratelimits]]` `RL_IP` 的 `limit`/`period` | Rate Limiting binding（按节点近似计数） | 429「操作过于频繁（每分钟最多 3 次）」 |
| 全站每日检查 | 300 次 | `CHECKS_GLOBAL_PER_DAY` | D1 `daily_counters` key `g:check`，单条 `INSERT … ON CONFLICT DO UPDATE … WHERE n < 上限 RETURNING`，并发下也不会超发 | 429 `global_quota`「今日检查名额已用完，请明天再来」 |
| 全站每分钟检查 | 30 次 | `[[ratelimits]]` `RL_GLOBAL` | Rate Limiting binding | 429 |
| 每账号同时进行中的检查 | 1 个 | 固定（超时 `REQUEST_TIMEOUT_MS`+45s 后视为失效锁） | D1 `inflight` | 409 `in_flight`「上一次检查还在进行中，请等待完成后再试」 |
| 每次检查国家数 | ≤3（多国检查只计 1 次） | `MAX_COUNTRIES` | 请求校验 | 400「一次最多选择 3 个国家」 |
| 图片张数 | ≤5 张 | `MAX_IMAGES`（上限 10） | 请求校验；Content-Length 先行拦截 | 400「最多上传 5 张图片」 |
| 单张图片大小 | ≤5MB（解码后字节）。前端**发送原图**，不缩放、不重新编码；只有超过 5MB 的图片才会被自动压缩到 5MB 以内并提示 | `MAX_IMAGE_BYTES` | 前端 + 请求校验 | 400「单张图片不能超过 5MB，请压缩后再上传」 |
| 图片总大小 / 请求体 | 5×5MB=25MB 图片，base64 JSON 约 33MB | `MAX_TOTAL_IMAGE_BYTES`（默认 26214400） | **读取请求体之前**按 `Content-Length` 拒绝；缺少该头返回 411 | 413 `too_large`「提交内容过大：最多 5 张图片，单张不超过 5MB…」 |
| 视觉识别 | 每批 ≤4 张且 ≤~9MB base64，批间并行，合并事实；整体预算 25s | `VISION_TIMEOUT_MS` | `runVisionAll` | 部分批次失败只丢这几张（`images_failed`），前端提示「部分图片未能识别」，检查照常完成 |
| 商品信息长度 | ≤10000 字（不会被静默截断：超出时前端提示「超出 N 字，请精简」，Worker 返回 413） | `INFO_MAX_CHARS`（不会超过 `src/lib/core/match.ts` 的 `MAX_DESC`=10000） | 请求校验；前端字数计数 | 413 `too_long`「商品信息最多 10000 字，请精简后再试」 |
| 全站每日验证码邮件 | 250 封 | `MAIL_GLOBAL_PER_DAY` | D1 `daily_counters` key `g:mail`（发送前预占，发送失败退回） | 429 `mail_global_quota`「今日验证码发送名额已用完，请明天再试」 |
| 每邮箱每日验证码 | 5 封 | `MAIL_PER_EMAIL_PER_DAY` | D1 `mail_counters` | 429 |
| 每 IP 每日验证码 | 10 封 | `MAIL_PER_IP_PER_DAY` | D1 `mail_counters` | 429 |
| 验证码重发冷却 | 60 秒 | 固定 | D1 `email_codes` | 429（带剩余秒数） |
| 每 IP 每日注册 | 3 个 | `REG_PER_IP_PER_DAY` | D1 `reg_ip` | 429 |
| 登录/注册/验证码请求频率 | 每 IP 每分钟 6 次 | `[[ratelimits]]` `RL_AUTH` | Rate Limiting binding | 429 |
| 超时 | 55s | `REQUEST_TIMEOUT_MS` | 前端 70s（带图片 150s，含上传时间） | 所有国家失败时返回错误；部分失败时该国显示规则结果 |
| 上游额度耗尽 | — | — | 智谱 1113/1308/1310/余额类错误 | 503 `quota`，前端提示稍后再试 |

“每日”按 UTC 日期计（北京时间 08:00 重置）。检查顺序：每分钟限流 → 输入校验 → 进行中锁 → 账号 → IP → 全站；后一步失败会退回前面已占用的名额，因此被拒绝的请求不消耗额度。前端在“开始检查”按钮下方显示「今日剩余 N 次」（来自 `/api/auth/me`）。

**修改上限**：
- 线上：改 `worker/wrangler.toml` 的 `[vars]`（或 `[[ratelimits]]` 的 `simple = { limit, period }`，period 只能是 10 或 60），然后 `cd worker && npx wrangler deploy`。也可以在 Cloudflare 控制台 Workers → Settings → Variables 临时改，但下次 `wrangler deploy` 会被 toml 覆盖。
- 本地：`npx wrangler dev --var CHECKS_GLOBAL_PER_DAY:1000 --var CHECKS_PER_USER_PER_DAY:1000 --var CHECKS_PER_IP_PER_DAY:1000`（`--var` 只影响本次 dev）。跑 39 条 eval 需要这样调高三个检查上限。
- 已移除：`RATE_LIMIT_PER_HOUR`（isolate 内存小时窗口，不可靠，已由 D1 每日计数取代）。

**测试**：`npm run test:e2e:limits`（需 Node 22 和 `cd worker && npm ci`）会自行启动临时 `wrangler dev`（全新本地 D1、低上限，如账号 2 / 全站 3 / IP 2 / 验证码全站 2），并开启仅在 localhost 生效的 `CHECK_DRY_RUN_LOCAL=1`（不调用智谱），验证账号上限、全站上限、IP 上限、进行中锁、国家数/图片/字数校验和验证码全站上限。

CORS 只放行 `ALLOWED_ORIGINS` 里的 origin；带其他 Origin 的浏览器请求返回 403。不带 Origin 的请求（curl/脚本）可以通过，但照样受限流约束。CORS 不是鉴权手段。

`RATE_LIMIT_DISABLED_LOCAL=1` 与 `CHECK_DRY_RUN_LOCAL=1` 只在请求主机名是 localhost/127.0.0.1 时生效，线上不起作用。前者关闭每分钟限流、每 IP 每日检查/注册/验证码计数（账号与全站每日检查上限**始终生效**）；后者让检查跳过 AI 调用直接返回。**不要在 wrangler.toml 里设置它们。**

### CPU 时间注意（Workers Free 计划每请求 10ms CPU）

登录/注册的 PBKDF2（100k 次）是 Worker 里最耗 CPU 的操作，在 Free 计划上可能触发 1102；遇到时调低 `PBKDF2_ITERATIONS` 或使用 Paid 计划。
等待上游 fetch 的时间不计入 CPU，但 JSON/SSE 解析会计入。在 Node 里粗测（含 TLS，偏高估）：
- `AGENT_IMPL=pi`（pi-agent-core + pi-ai 流式）：热启动约 150–180ms CPU；
- `AGENT_IMPL=fetch`（非流式的精简工具循环）：约 20–55ms。

workerd 的实际值会低一些，但 pi 模式在免费层**有可能触发 1102（CPU 超限）**。如果在 `wrangler tail` 里看到 1102，把 `AGENT_IMPL` 改成 `"fetch"`，或者升级到 Workers Paid（$5/月，30s CPU）。两种模式输出相同的结构，前端无需改动。Bundle 约 768 KiB gzip，低于免费层 3 MiB 上限。

#### 大图片请求体的 CPU / 内存风险（重要）

一次检查最多 5 张、单张 ≤5MB 的原图，请求体（base64 JSON）最坏约 **33MB**；Cloudflare 各计划的请求体上限是 100MB（Free/Pro），所以不会被平台直接拒绝，但：

- **Workers Free 每请求仅 10ms CPU**。`req.text()` + `JSON.parse` 一个 ~31MB 的字符串，在 Node 里粗测约 **30ms**（workerd 会有差异）。我们已把能省的省掉：先按 `Content-Length` 拒绝超限请求、base64 只校验前缀与 `"`/`\`（不用全串正则）、发给视觉模型的请求体用字符串拼接而不是 `JSON.stringify`（后者在 Node 里约 90ms）。**大图（接近 25MB）在 Free 计划上仍可能触发 1102**；几百 KB 的普通商品图（总计 <1MB）没有问题。上游等待时间不计 CPU。
- 内存上限 128MB：最坏情况下请求文本 + 解析后的字符串 + 并行的视觉请求体合计约 80–90MB，余量有限；这也是视觉批次按 ≤~9MB base64 拆分的原因之一。
- **建议**：预期用户会上传大量原图时使用 **Workers Paid（$5/月，30s CPU）**；或者把 `MAX_IMAGE_BYTES` / `MAX_TOTAL_IMAGE_BYTES` 调小（例如 1MB / 5MB，前端同步改 `src/lib/image.ts` 里的 `MAX_IMAGE_BYTES`）。看到 1102 时可先用 `wrangler tail` 确认。
- 为什么没改成 multipart/二进制上传：视觉模型的接口要求 JSON 里带 base64 data URL，Worker 收到二进制后还得自己做 base64 编码，CPU 不会比解析 base64 JSON 少；除非把图片先放到 R2 再给模型 URL（需要额外存储与公开链接，与“图片不保存”的承诺冲突）。因此保持 JSON。

本地实测（wrangler dev，真实智谱接口）：3 国 + 5 张 ~4.95MB 原图（31.5MB 请求体）+ 10000 字：约 27–30s，其中视觉 5–9s。

## 2. GitHub Pages

1. 新建仓库并推送（例如仓库名 `sea-precheck`）。
2. Settings → Pages → Source 选 **GitHub Actions**。
3. Settings → Secrets and variables → Actions → **Variables**：
   - `API_URL` = Worker 地址（例如 `https://sea-precheck-api.<sub>.workers.dev` 或自定义域）。它是公开值，不是密钥；
   - 可选 `PAGES_BASE_PATH`：项目站默认 `/<仓库名>`；用户站或自定义域设成空字符串。
4. 推送到 `main` 会触发 `.github/workflows/pages.yml`：`npm ci` → `kb:verify` → `next build` → 上传 `out/` → 部署。
5. 把 Pages 的 origin（`https://<user>.github.io`，或者你的自定义域）写回 Worker 的 `ALLOWED_ORIGINS`，然后重新 `wrangler deploy`。

本地模拟 Pages 子路径：
```bash
NEXT_PUBLIC_BASE_PATH=/sea-precheck NEXT_PUBLIC_API_URL=http://localhost:8787 npx next build
```

## 3. 中国大陆访问性（重要）

- **`*.workers.dev` 在大陆基本不可用**。GreatFire 的长期监测显示整个后缀被 DNS 污染或丢包（https://en.greatfire.org/domain/workers.dev）。由于登录与检查都依赖 Worker，大陆用户在这种情况下无法使用。
- **`*.github.io` 时好时坏**：DNS 污染和限速都常见，可能要多刷几次或者很慢。
- **自定义域名能明显改善，但不能保证**：
  - 把自有域名托管到 Cloudflare，再给 Worker 绑 Custom Domain（`wrangler.toml` 里写 `routes = [{ pattern = "api.example.com", custom_domain = true }]`），就能绕开 workers.dev 的整体封锁。社区实测多数地区可达，但走的是海外节点，延迟较高，个别 IP 段也可能被干扰。
  - Pages 前端同样可以绑定自定义域（CNAME 指向 `<user>.github.io`）。也可以考虑改用 Cloudflare Pages，静态站和 Worker 放在同一个自定义域下，避免跨域。
  - **没有 ICP 备案就用不了大陆 CDN 节点**。Cloudflare China Network 需要 Enterprise 合同加 ICP 备案。真想在大陆稳定访问，只能把服务放到备案过的国内主机或 CDN 上（阿里云、腾讯云等），这需要额外的备案与费用。
- 智谱 API（open.bigmodel.cn）在国内，Worker 从海外节点调用它目前是通的，本地 wrangler dev 实测可用。

## 4. 更新知识库
见 `kb/README.md`。改 `kb/build_rules.py`，然后运行 `npm run kb:build && npm run kb:verify`，提交后 Pages 会自动重新构建。

## 关于 GLM Coding Plan 密钥

Coding Plan 套餐的定位是"在编程工具里使用"。把它用作公开网站的后端是否符合智谱的服务条款，请在上线前自行查阅套餐条款/咨询客服；如有疑问，改用按量付费 key + `LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4`（只需改 vars 和 secret，代码不变）。
