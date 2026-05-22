# cartog 已移除 → code-graph 替代

关键词：`cartog` `code-graph` `清理` `替代` `代码图`

## cartog 移除记录 (2025-05-22)

cartog 扩展及其相关库已完全从 pi-atelier 中移除。详见上方 AGENTS.md 的清理列表。

## code-graph 替代 (2025-05-22)

### 工具选型评估

| 工具 | TS 覆盖度 | 影响/调用图 | IO 压力 | 结论 |
|------|----------|------------|---------|------|
| **Cartog** | ~95% 符号 / 37-81% 边 | ⭐⭐ | 低 | 已移除 |
| **CKB** | ~98% 符号 / 90-98% 边（SCIP） | ⭐⭐（实测报 0 caller） | **高**（扫 node_modules） | 不采用 |
| **code-graph** | ~95% 符号 / ~80% 边 | ⭐⭐⭐⭐（108 总调用者） | 低 | ✅ 采用 |

### code-graph 优势
- Rust 写的单 binary，npm 分发（`@sdsrs/code-graph`）
- 纯 tree-sitter，不跑类型检查，不扫 node_modules
- 支持 16 种语言：TS/Go/Python/Rust/Java 等
- 影响分析实测远优于 CKB（DataStore → 108 总调用者 vs CKB 报 0）
- HTTP 路由全链路追踪（routes_to 关系）
- MCP server 模式：`code-graph serve` 暴露 7 个工具

### 已集成的功能
- `formatters-codegraph.ts` — code-graph 工具输出格式化器
- `raw-writer.ts` — 从 processor-core 拆出的辅助模块
- MCP 配置：`~/.pi/agent/mcp.json` 中 `code-graph` server
- 7 个工具名：search_symbols, get_call_graph, get_ast_node, project_map, module_overview, ast_search, find_references

### 已知局限
- `api.registerTool('xxx', handler)` 回调追踪 — tree-sitter 固有限制
- Rust trait impl 追踪不完整
- 跨 PyO3 边界断裂
- "exported-unused" 可能是扩展入口（被 pi 运行时调用），不是真死代码
