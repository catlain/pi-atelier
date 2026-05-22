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
│   └── [legacy]        # cartog-manager (unused, pending cleanup)
├── docs/agent/          # Architecture documentation (you are here)
└── vitest.config.ts     # Monorepo test config
```

## Search Priority — 搜索优先级

⚠️ **所有功能实现、命令、工具的代码都在本仓库的 `extensions/` 和 `lib/` 里**，不在 pi 的全局安装目录。

搜索顺序：
1. **先搜当前项目**：`grep` / `code_intel` / `ls` 在 `extensions/` 和 `lib/` 下搜索
2. **关键词模糊匹配**：搜不到时用模糊搜索（如 `grep -ri "aging\|ago" extensions/`），而不是立刻跳到其他目录
3. **最后才看全局安装**：仅在需要查阅 pi 核心 API（ExtensionAPI 类型定义、events 接口等）时，才去全局安装目录

典型错误：用户提到一个命令/功能，AI 直接去 pi 全局安装目录搜索 → 找不到 → 反复重试。正确做法是先在 `extensions/` 中搜索。

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

## Coding Conventions

- TypeScript strict mode throughout
- Formatter functions: pure `(text: string) => string`, return original on mismatch
- Shepherd rules: JSON array with regex patterns, evaluated in order
- Extension entry: `index.ts` exports default function accepting `ExtensionAPI`
- Tests: vitest with `*.test.ts` naming, colocated in `tests/` subdirectory or alongside source
- No cross-extension imports — use `pi.events` or settings for inter-extension communication
