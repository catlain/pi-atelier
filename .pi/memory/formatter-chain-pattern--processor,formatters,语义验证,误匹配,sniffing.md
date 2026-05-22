# Tool-Result Processor Formatter 链设计模式

关键词：`processor` `formatters` `语义验证` `误匹配` `sniffing`

## 架构

`tool-result-processor-core.ts` 维护一个 formatter 链，顺序嗅探匹配：

```
[formatWebSearchResult, formatGhResult, formatWebReadResult, formatCodeGraphResult, formatBashResult, formatMcpError]
```

每个 formatter 签名：`(text: string) => string`，返回原文表示"不匹配"。

## 文件拆分

- `formatters.ts` — formatBashResult + formatMcpError + re-export
- `formatters-web.ts` — formatWebReadResult + formatWebSearchResult
- `formatters-gh.ts` — formatGhResult
- `formatters-codegraph.ts` — formatCodeGraphResult（code-graph MCP 工具输出）
- `formatters-utils.ts` — unwrapDoubleEncodedJson, truncateAtParagraph, extractJsonPrefix
- `raw-writer.ts` — writeRawToFile + 辅助函数（从 core 提取）

## 关键设计原则

**格式嗅探必须验证语义字段，不能只检查 JSON 结构。**

### 已修复的误匹配 bug（同类问题）

1. **formatWebSearchResult** — 只检查"是数组+非空" → 非 web_search 数据被误匹配
   - 修复：`results.some(r => r.link || r.title)`
2. **formatGhResult** — `"path" in obj || "content" in obj` → web_read 数据被误匹配
   - web_read 的 `{title, url, content}` 含 `content` 但不含 `path`
   - 修复：收紧为 `"path" in obj`（gh_read_file 总是有 path）
3. **formatCodeGraphResult** — 初版弱特征（`^Modules:\s*$`）可能误匹配
   - 修复：去掉弱特征，每条嗅探规则本身足够独特

### 嗅探策略分类

| 策略 | 适用场景 | 例子 |
|------|---------|------|
| JSON 结构验证 | JSON 输出 | web_search（检查 link/title） |
| 内容模式匹配 | 纯文本输出 | code-graph（检查符号行模式） |
| 工具名路由 | 当架构支持时 | 目前不支持，纯内容嗅探 |

### 教训

- 只检查"是数组+非空"是最弱的守卫，任何 JSON 数组都会匹配
- 必须检查**语义上有意义的字段**或**足够独特的内容模式**
- 添加新 formatter 时，先用现有数据跑回归测试
- 内容嗅探的强特征：每条规则单独命中即判定，不要求多条同时命中

### 测试陷阱

- **`getContextConfig()` 读取用户 settings**（不是默认值），测试必须显式传 `distillThreshold`
  - 否则测试结果依赖外部状态，在不同机器上行为不一致
- formatters-errors 测试在 `tests/` 子目录中，import 需用 `../formatters-errors.js`
