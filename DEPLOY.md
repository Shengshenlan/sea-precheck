# 部署说明（GitHub Pages + Cloudflare Workers，均为免费层）

架构：
- **前端**：Next.js 静态导出（`output: "export"`），托管在 GitHub Pages。知识库（kb/rules.json）和确定性规则匹配全部在浏览器里运行，后端不可用时也能出完整的纯规则报告。
- **LLM 后端**：`worker/` 目录，Cloudflare Worker，提供 `POST /api/check` 和 `GET /api/health`。只返回 LLM 的部分（品类/特征识别、补充规则 ID、引用摘录与解释）。前端会把它和本地规则报告合并，并**再校验一遍**引用。
- **密钥**：`ZHIPUAI_API_KEY` 只作为 Worker secret 存在。不进 git、不进日志、不进前端 bundle。

> 本仓库作者尚未执行下面任何一步，也没有创建账号或推送。

## 1. Cloudflare Worker

```bash
cd worker
npm ci                                   # wrangler 4.x 需要 Node >= 22
npx wrangler login                       # 浏览器登录 Cloudflare 账号（免费）
npx wrangler secret put ZHIPUAI_API_KEY  # 交互式粘贴，不会写入文件
# 编辑 wrangler.toml 的 [vars]：
#   ALLOWED_ORIGINS = "https://<user>.github.io"        # 只写 origin，不带路径；多个用逗号分隔
#   LLM_MODEL       = "glm-4.5-flash"                   # 已验证可用
#   AGENT_IMPL      = "pi"  或 "fetch"                   # 见下文 CPU 说明
npx wrangler deploy
curl https://sea-precheck-api.<sub>.workers.dev/api/health
```

`ratelimits` 里的 `namespace_id`（1001/1002）是账号内自选的整数，部署时保证不与其他 Worker 冲突即可。

### 限流方案（免费层）
| 层 | 实现 | 说明 |
|---|---|---|
| 每 IP 每分钟 3 次 | `RL_IP` Rate Limiting binding（`cf-connecting-ip` 为 key） | 免费可用。period 只能是 10 或 60 秒；按 Cloudflare 节点计数、属于近似值。官方不推荐用 IP 当 key（NAT/IPv6），这里是务实折中 |
| 全局每分钟 30 次 | `RL_GLOBAL` binding（固定 key） | 保护上游智谱免费额度/并发 |
| 每 IP 每小时约 10 次 | isolate 内存滑动窗口（`RATE_LIMIT_PER_HOUR`） | **尽力而为**：isolate 回收或请求落到不同节点都会重置。需要严格小时额度时改用 Durable Object（免费层已支持 SQLite DO）或 KV（免费写额度较少） |
| 输入 | body ≤ 8KB，标题 ≤ 200 字，描述 ≤ 2000 字 | 超限返回 413 |
| 超时 | `REQUEST_TIMEOUT_MS`（默认 55s），前端 60s | 超时返回 504，前端退回纯规则结果 |
| 额度耗尽 | 智谱 1113/1308/1310/余额类错误 → 503 `{code:"quota"}` | 前端提示“AI 免费额度已用完，以下为纯规则结果” |

CORS 只放行 `ALLOWED_ORIGINS` 里的 origin；带其他 Origin 的浏览器请求返回 403。不带 Origin 的请求（curl/脚本）可以通过，但照样受限流约束。CORS 不是鉴权手段。

`RATE_LIMIT_DISABLED_LOCAL=1` 只在请求主机名是 localhost/127.0.0.1 时生效，用于本地 eval，线上不起作用。**不要在 wrangler.toml 里设置它。**

### CPU 时间注意（免费层每请求 10ms CPU）
等待上游 fetch 的时间不计入 CPU，但 JSON/SSE 解析会计入。在 Node 里粗测（含 TLS，偏高估）：
- `AGENT_IMPL=pi`（pi-agent-core + pi-ai 流式）：热启动约 150–180ms CPU；
- `AGENT_IMPL=fetch`（非流式的精简工具循环）：约 20–55ms。

workerd 的实际值会低一些，但 pi 模式在免费层**有可能触发 1102（CPU 超限）**。如果在 `wrangler tail` 里看到 1102，把 `AGENT_IMPL` 改成 `"fetch"`，或者升级到 Workers Paid（$5/月，30s CPU）。两种模式输出相同的结构，前端无需改动。Bundle 约 768 KiB gzip，低于免费层 3 MiB 上限。

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

- **`*.workers.dev` 在大陆基本不可用**。GreatFire 的长期监测显示整个后缀被 DNS 污染或丢包（https://en.greatfire.org/domain/workers.dev）。前端会退回纯规则结果，但 AI 部分对大陆用户等于不可用。
- **`*.github.io` 时好时坏**：DNS 污染和限速都常见，可能要多刷几次或者很慢。
- **自定义域名能明显改善，但不能保证**：
  - 把自有域名托管到 Cloudflare，再给 Worker 绑 Custom Domain（`wrangler.toml` 里写 `routes = [{ pattern = "api.example.com", custom_domain = true }]`），就能绕开 workers.dev 的整体封锁。社区实测多数地区可达，但走的是海外节点，延迟较高，个别 IP 段也可能被干扰。
  - Pages 前端同样可以绑定自定义域（CNAME 指向 `<user>.github.io`）。也可以考虑改用 Cloudflare Pages，静态站和 Worker 放在同一个自定义域下，避免跨域。
  - **没有 ICP 备案就用不了大陆 CDN 节点**。Cloudflare China Network 需要 Enterprise 合同加 ICP 备案。真想在大陆稳定访问，只能把服务放到备案过的国内主机或 CDN 上（阿里云、腾讯云等），这超出了“免费”的范围。
- 智谱 API（open.bigmodel.cn）在国内，Worker 从海外节点调用它目前是通的，本地 wrangler dev 实测可用。

## 4. 更新知识库
见 `kb/README.md`。改 `kb/build_rules.py`，然后运行 `npm run kb:build && npm run kb:verify`，提交后 Pages 会自动重新构建。
