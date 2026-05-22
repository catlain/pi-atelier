# Cartog 已移除 → code-graph 替代

关键词：`cartog` `code-graph` `代码图` `MCP` `选型`

## 历史

Cartog（jrollin/cartog）曾是 pi-atelier 的代码索引工具，通过专用扩展集成。后因覆盖度不足被移除。

## 选型决策（2025-05）

对比了三个代码图工具，在 pi-atelier（TS）和 quant-strategy（Rust+Python）上实测：

### CKB（@tastehub/ckb）— 淘汰
- scip-typescript 索引跑完整 tsc 类型检查，**扫描 node_modules → IO 打满 → WSL 崩溃**
- 影响分析实测报 0 caller（pi-atelier 的插件架构）
- TS Tier 2 但实际体验不如预期
- Go 是 Tier 1（编译器级精度），但 TS/Python 表现一般

### code-graph（@sdsrs/code-graph）— ✅ 选用
- **纯 tree-sitter 解析，不碰 node_modules，IO 安全**
- 305 文件 / 0.7s 索引 / 3MB，比 CKB 快 4 倍
- 影响分析远优于 CKB：`DataStore` → 108 总调用者 / 49 文件（CKB 报 0）
- 16 种语言：TS/JS/Go/Python/Rust/Java/C#/PHP/Swift/Ruby/Dart/C/C++/Kotlin/HTML/CSS
- `implements` 关系（接口→实现追踪）— CKB 和 Cartog 都没有
- `routes_to` 关系（HTTP 路由全链路追踪）— 独有
- MCP server：7 个工具（search_symbols, get_call_graph, get_ast_node, project_map, module_overview, ast_search, find_references）

### Cartog（jrollin/cartog）— 之前用的
- tree-sitter + SQLite，37-81% 边解析率
- 符号搜索强，但影响分析弱

## 所有工具的共同盲区

- 插件回调注册（`api.registerTool('xxx', handler)`）→ 运行时行为
- 跨 PyO3/FFI 边界 → 两种语言的调用关系断裂
- Rust trait impl → tree-sitter 无法完整追踪
- 动态调用（`obj[method]()`、`reflect.Call`）

## 已完成的集成

- 格式化器：`formatters-codegraph.ts` + 22 个单元测试
- Processor 链注册：`tool-result-processor-core.ts`
- Shepherd steer 规则：grep 搜索函数时提醒用 code-graph
- AGENTS.md Code Intelligence 段落：6 种使用场景引导
- MCP 配置：`~/.pi/agent/mcp.json`
