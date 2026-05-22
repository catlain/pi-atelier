# Tool-Result Processor Formatter 链设计模式

关键词：`processor` `formatters` `语义验证` `误匹配` `sniffing`

## 架构

`tool-result-processor-core.ts` 维护一个 formatter 链，顺序嗅探匹配：

```
[formatWebSearchResult, formatGhResult, formatWebReadResult, formatBashResult, formatMcpError]
```

每个 formatter 签名：`(text: string) => string`，返回原文表示"不匹配"。

## 文件拆分

- `formatters.ts` — formatBashResult + formatMcpError + re-export
- `formatters-web.ts` — formatWebReadResult + formatWebSearchResult
- `formatters-gh.ts` — formatGhResult
- `formatters-utils.ts` — unwrapDoubleEncodedJson, truncateAtParagraph, extractJsonPrefix

## 关键设计原则

**格式嗅探必须验证语义字段，不能只检查 JSON 结构。**

### 已修复的误匹配 bug（同类问题）

1. **formatWebSearchResult** — 只检查"是数组+非空" → 非 web_search 数据被误匹配
   - 修复：`results.some(r => r.link || r.title)`
2. **formatGhResult** — `"path" in obj || "content" in obj` → web_read 数据被误匹配
   - web_read 的 `{title, url, content}` 含 `content` 但不含 `path`
   - 修复：收紧为 `"path" in obj`（gh_read_file 总是有 path）

### 教训：每个 formatter 必须有足够窄的语义守卫

- 只检查"是数组+非空"是最弱的守卫，任何 JSON 数组都会匹配
- 必须检查**语义上有意义的字段**（如 `link`、`title`、`path`）
- 添加新 formatter 时，先用现有数据跑回归测试

### 测试陷阱

- **`getContextConfig()` 读取用户 settings**（不是默认值），测试必须显式传 `distillThreshold`
  - 否则测试结果依赖外部状态，在不同机器上行为不一致
- formatters-errors 测试在 `tests/` 子目录中，import 需用 `../formatters-errors.js`
