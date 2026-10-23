# 知识库（KB）

- `build_rules.py`：**唯一的编写源**。运行 `python3 kb/build_rules.py` 会生成 `rules.json`；每次发布都要递增 `VERSION`（格式 `YYYY.MM.DD-n`）。
- `rules.json`：前端和 Worker 共用。字段包括 `id / country / categories / items / features / platforms / kind（cert|display|platform|customs|review）/ mandatory / needs_review / requires_cert_prefix / title / cert / authority / requirement / effective_date / retrieved_date / excerpts[] / next_steps`。
- `excerpts[]`：每条都有 `text / lang / source_url / source_title / source_type（official|official_translation|secondary|platform）/ verification / snapshot / retrieved_date`。
  - `verified`：在 `snapshots/*.txt` 中逐字找到（比对时忽略空白和引号差异）；
  - `verified_ocr`：快照来自扫描 PDF 的 OCR，已与原图比对；
  - `paraphrase`：拿不到原文，是转述。UI 会标注“转述（非原文）· 待人工复核”，并且 LLM 不能把转述当引用。
- `snapshots/`：官方页面或 PDF 的文本快照，只提交 `.txt`（附 `snapshots.sha256`）。PDF、HTML 原件和第三方文章全文都已 gitignore，原因是版权；用 `source_url` 可以重新获取。
- `npm run kb:verify`：逐条核对摘录是否真的出现在快照里。快照缺失的条目会计数，但不算失败。

规则：**绝不编造引文**。拿不到原文时，写成转述并标 `paraphrase`，附上能找到的最佳来源 URL。
