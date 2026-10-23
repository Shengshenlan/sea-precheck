# Vision model probe (2026-10-23, Coding Plan key, test image img-th-kettle.jpg)

| endpoint | model | result |
|---|---|---|
| coding/paas/v4 | glm-5v-turbo | 429 / 1311 套餐未开放 |
| coding/paas/v4 | **glm-4.6v** | **200, correct (SONIQ, Smart Kettle, มอก. TIS 1561), ~2.9 s** |
| coding/paas/v4 | glm-4.6v-flash | 429 / 1305 访问量过大 |
| coding/paas/v4 | glm-4.5v | 200, correct, ~1.7 s |
| coding/paas/v4 | glm-4v-flash, glm-4.1v-thinking-flash | 429 / 1314 套餐已失效 |
| paas/v4 (standard) | glm-5v-turbo, glm-4.6v, glm-4.5v | 200 (likely billed to account balance, not the plan) |
| paas/v4 (standard) | glm-4.6v-flash | 429 / 1305 |
| paas/v4 (standard) | glm-4v-flash, glm-4.1v-thinking-flash | 429 / 1314 |

Chosen default: VISION_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4, VISION_MODEL=glm-4.6v.
