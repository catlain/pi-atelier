# Tool-Result Processor Formatter 链设计模式

关键词：`processor` `formatters` `语义验证` `误匹配` `cartog`

## 架构

`tool-result-processor-core.ts` 维护一个 formatter 链，顺序嗅探匹配：

```
[formatWebSearchResult, formatGhResult, formatWebReadResult, formatCartogResult]
```

每个 formatter 签名：`(text: string) => string`，返回原文表示"不匹配"。

## 文件拆分（2025-05 commit b889571）

- `formatters.ts` — formatCartogResult + formatBashResult + formatMcpError + re-export
- `formatters-web.ts` — formatWebReadResult + formatWebSearchResult
- `formatters-gh.ts` — formatGhResult
- `formatters-utils.ts` — unwrapDoubleEncodedJson, truncateAtParagraph, extractJsonPrefix

## 关键设计原则

**格式嗅探必须验证语义字段，不能只检查 JSON 结构。**

教训：`formatWebSearchResult` 只检查"是数组+非空"，导致 cartog 返回的
`[{name,kind,startLine}]` 被误匹配为 web_search 结果（输出空 URL）。

修复：`results.some(r => r.link || r.title)` — 至少一个条目必须有 web_search 特征字段。

`formatGhResult` 是正确范例：检查 `results`/`path`/`content`/`tree` 具体字段。

## 已知预存问题

- `tool-result-processor.test.ts` 等 16 个测试在 main 分支就已失败（mock 文件路径相关）
- `tests/formatters-errors.test.ts` 有 import 路径问题（`no tests`）
