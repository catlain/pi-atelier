# Pi-Atelier — Extension Forge for pi-coding-agent

## What This Project Is

Pi-atelier builds and maintains **extensions** for [pi-coding-agent](https://github.com/earendil-works/pi-coding-agent) — an AI coding agent with a plugin architecture. Each extension registers tools, commands, and event hooks via the `ExtensionAPI`.

## Repository Structure

```
pi-atelier/
├── extensions/          # 13 independent extension packages
│   ├── context/         # Tool result processing, distill, context panel
│   ├── shepherd/        # Line count guard, rtk rewrite, behavior rules
│   ├── plan-verify/     # Plan→Verify→Execute workflow via subagents
│   ├── mcp-lite/        # Lightweight MCP client (replaces pi-mcp-adapter)
│   ├── memory/          # File-based persistent memory for AI agent
│   ├── session-analyzer/# Historical session search and analysis
│   ├── scheduler/       # Timer/recurring task management
│   ├── subagent/        # Sub-agent spawning and model management
│   ├── env-and-status/  # Environment detection, status management
│   ├── payload-analyzer/# Provider payload token analysis
│   ├── notification/    # Desktop notifications (notify-send)
│   ├── journal/         # Session journaling
│   └── workflow/        # Barrel re-export of workflow-core for extensions
├── lib/                 # Shared libraries (no pi dependency)
│   ├── shared-utils/    # Memory parser, settings, paths, tool output truncation
│   ├── workflow-core/   # Subagent spawn, research workflow, output capture
│   ├── shepherd/        # Shepherd rules engine (line count, pattern matching)
│   └── [legacy]        # (cleaned up)
├── docs/agent/          # Architecture documentation (you are here)
└── vitest.config.ts     # Monorepo test config
```

## Key Architectural Decisions

1. **Extensions are isolated** — no cross-extension imports. Communication via events or settings only.
2. **Libraries are pure** — no pi dependency. Extensions import from libs, never the reverse.
3. **Tool result processing** is a formatter chain in context extension (web_search → gh → web_read → bash → mcp_error).
4. **Subagent pattern** — plan-verify and workflow spawn child pi processes for isolated task execution.
5. **MCP integration** via mcp-lite: connects to MCP servers, caches tool definitions, processes responses.

## Quick Orientation

| Want to understand... | Read... |
|----------------------|---------|
| How tool results get formatted | `extensions/context/tool-result-processor-core.ts` → `formatters.ts` → `formatters-*.ts` |
| How the shepherd guard works | `lib/shepherd/src/rules-engine.ts` → `extensions/shepherd/index.ts` |
| How plan-verify orchestrates subagents | `extensions/plan-verify/index.ts` → `lib/workflow-core/src/subagent.ts` |
| How MCP tools are registered | `extensions/mcp-lite/index.ts` → `mcp-client.ts` → `tool-builder.ts` |
| How memory persistence works | `extensions/memory/index.ts` → `lib/shared-utils/src/memory-parser.ts` |
| How to add a new extension | See README § "Extension Development" |

## Build & Test

```bash
# Install dependencies
npm install

# Build all packages
npm run build          # or: npx tsup

# Run all tests
npx vitest run

# Run specific extension tests
npx vitest run extensions/context/
npx vitest run extensions/shepherd/tests/

# Type check
npx tsc --noEmit
```

## Code Intelligence (code-graph)

项目已配置 `code-graph` MCP server（通过 `~/.pi/agent/mcp.json`）。在以下场景优先使用 code-graph 工具而非 grep/find：

| 场景 | 用什么 | 工具名 |
|------|--------|--------|
| 搜索函数/类/变量名 | `search_symbols` | 比 grep 精确，直接匹配符号名 |
| 查看项目架构 | `project_map` | 自动识别模块、依赖、入口 |
| 查找谁调用了 X | `find_references` | 含 call/import/export 全类型引用 |
| 追踪调用链 | `get_call_graph` | callers/callees 深度追踪 |
| 修改前评估影响 | `find_references` + 分析 | blast radius 评估 |
| 查找死代码 | `dead_code` | exported-unused / orphan 检测 |
| 模块内部结构 | `module_overview` | 文件级符号列表 |

**使用原则**：
- **搜索已知名称** → code-graph `search_symbols` > grep
- **理解调用关系** → code-graph `find_references` / `get_call_graph` > 手动 grep
- **评估变更影响** → code-graph `find_references` 先查引用，再决定改不改
- **探索不熟悉的模块** → code-graph `module_overview` 先看结构，再 read 代码
- **找不到时 fallback** → code-graph 找不到再用 grep，可能符号名拼写不同

## Coding Conventions

- TypeScript strict mode throughout
- Formatter functions: pure `(text: string) => string`, return original on mismatch
- Shepherd rules: JSON array with regex patterns, evaluated in order
- Extension entry: `index.ts` exports default function accepting `ExtensionAPI`
- Tests: vitest with `*.test.ts` naming, colocated in `tests/` subdirectory or alongside source
- No cross-extension imports — use `pi.events` or settings for inter-extension communication
