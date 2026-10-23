# 东南亚跨境上架前合规预检（TH / PH / MY）

一个免费的个人业余项目，帮中国跨境卖家在 **TikTok Shop / Shopee / Lazada** 上架 **泰国、菲律宾、马来西亚** 之前，自查四类商品（小家电、充电器/适配器/充电宝、玩具、化妆品）的：

1. 认证 / 许可（TISI、FDA、NBTC、DTI PS/ICC、NTC、SIRIM/ST、MCMC、KPDN、NPRA…）
2. 平台禁售 / 限售命中
3. 商品页展示义务（泰国 ETDA 2025-12-31 生效；菲律宾 DTI DAO 25-02）
4. 商标 / 品牌词风险（附 TMview 与各国商标局查询链接；**从不声称"不侵权"**）
5. 风险等级与下一步

印尼（FOB US$100）、越南（低值进口 VAT）仅作为提示出现。

> ⚠️ **不是法律意见。** 法规会变（例：印尼清真认证截止日期从 2026-10-18 被推迟到 2028-10-17）。每条结论都附知识库原文引用与来源链接；没有依据的内容一律标"待人工复核"。

## 架构

```
GitHub Pages（静态 Next.js export）               Cloudflare Worker（worker/）
  ├─ 知识库 kb/rules.json 打包进前端                  POST /api/check
  ├─ 确定性匹配：关键词/品类识别 + BM25 + 规则        ├─ pi-mono Agent（pi-agent-core + pi-ai）
  ├─ 品牌词库命中                                     │   工具：lookup_rules / get_rule / check_brand
  └─ 调用 NEXT_PUBLIC_API_URL（可选）──────────────▶  ├─ 智谱 OpenAI 兼容接口（LLM_BASE_URL / LLM_MODEL）
       失败/未配置 → 只显示规则结果                    ├─ 输出 JSON → 校验：rule_id 必须在候选集、quote 必须是原文逐字子串
                                                      └─ 每 IP 限流、CORS、输入上限、超时、额度用尽友好提示
```

- 规则与确定性匹配优先；LLM 只负责品类判断、边缘特征（如无线/蓝牙）、补充规则和中文解释。
- LLM 给的引用在服务端和前端各校验一次，不是原文子串的引用会显示为"待人工复核"或直接丢弃。
- 不存储任何用户输入；Worker 日志只记 `{evt, code, ms}`。

## 知识库

- `kb/build_rules.py` → `kb/rules.json`（版本 `2026.10.23-1`，62 条规则）
- `kb/snapshots/`：抓取的来源原文快照 + `kb/snapshots.sha256`
- `npm run kb:verify`：逐条校验摘录是否是快照的逐字子串。当前共 126 条摘录：115 条 verified、6 条 verified_ocr（扫描件 OCR）、5 条 paraphrase（明确标注为转述，主要是 Shopee/Lazada 帮助中心无法抓取的平台规则）。
- 详见 `kb/README.md`。

## 本地运行

```bash
npm ci
npm run kb:verify
NEXT_PUBLIC_API_URL=http://127.0.0.1:8787 npx next build   # 产物在 out/
npm run serve                                              # http://127.0.0.1:3000/

# Worker（wrangler 4 需要 Node 22）
cd worker && npm ci
printf 'ZHIPUAI_API_KEY=...\n' > .dev.vars && chmod 600 .dev.vars   # 已 gitignore，切勿提交
npx wrangler dev --port 8787
curl http://127.0.0.1:8787/api/health
```

`wrangler.toml` 变量：`LLM_BASE_URL`（默认 `https://open.bigmodel.cn/api/paas/v4`）、`LLM_MODEL`（默认 `glm-4.5-flash`）、`AGENT_IMPL`（`pi` | `fetch`）、`REQUEST_TIMEOUT_MS`、`ALLOWED_ORIGINS`、`RATE_LIMIT_PER_HOUR`。密钥只用 `wrangler secret put ZHIPUAI_API_KEY`。

## 评测

```bash
npm run eval:baseline                                    # 纯规则
npx tsx eval/run.ts --api http://127.0.0.1:8788 --label glm-4.5-flash --concurrency 1
```

`eval/samples.json` 共 39 条（3 国 × 4 品类），结果写入 `eval/results/<label>.json`。指标：认证召回/精确率、完全匹配、品类准确率、幻觉引用率（未通过校验 + 因 rule_id 不存在被丢弃的 notes 占比）、待复核率、品牌命中、延迟、失败码。

## 部署

见 [DEPLOY.md](DEPLOY.md)（GitHub Pages + Cloudflare Workers 免费档、限流说明、CPU 10ms 限制、国内可达性）。
