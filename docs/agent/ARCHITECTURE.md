# Architecture

Status: current
Evidence: observed
Last validated: 2025-05-22

## Architecture Overview

**Style**: Plugin architecture. pi-coding-agent is the host; each extension registers tools, commands, and event handlers via `ExtensionAPI`. Extensions are independent leaf modules connected only through shared libraries and the pi event bus.

```
┌──────────────────────────────────────────────────────────────┐
│  pi-coding-agent (host)                                      │
│  ExtensionAPI: registerTool, registerCommand, on(event)      │
│  Event bus: pi.events (cross-extension communication)        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ context  │ │ shepherd │ │ mcp-lite │ │ env-and-     │   │
│  │ (distill │ │ (hooks)  │ │ (tools)  │ │ status       │   │
│  │  aging)  │ │          │ │          │ │              │   │
│  └────┬─────┘ └────┬─────┘ └──────────┘ └──────────────┘   │
│       │            │                                        │
│       │   ephemeral:hint (pi.events)                        │
│       ├───────────>│                                        │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ memory   │ │session-  │ │ payload- │ │notification  │   │
│  │          │ │analyzer  │ │ analyzer │ │              │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │roadmap   │ │scheduler │ │subagent  │ │ journal(WIP) │   │
│  │(plans)   │ │          │ │          │ │              │   │
│  └──────────┘ └──────────┘ └────┬─────┘ └──────────────┘   │
│                                                              │
│  ┌──────────────┐                                           │
│  │smart-compact │ 事件接管 compaction                        │
│  │(分段+筛选)   │                                           │
│  └──────────────┘                                           │
│       │                        │                            │
├───────┼────────────────────────┼────────────────────────────┤
│  Shared Libraries              │                            │
│  ┌──────────────┐  ┌──────────┴─────┐  ┌──────────────┐   │
│  │ shared-utils │  │ workflow-core  │  │ shepherd lib │   │
│  │ (paths,types)│  │ (state machine)│  │ (rule engine)│   │
│  └──────────────┘  └────────────────┘  └──────────────┘   │
│  ┌──────────────┐                                           │
└──────────────────────────────────────────────────────────────┘
```

## Component Map

### Extensions (Leaf Modules)

#### smart-compact

**Purpose**: 增强版 compaction，解决超长 session 的 serialize 后超过 LLM 窗口问题。

**Mechanism**: 监听 `session_before_compact` 事件，返回 `CompactionResult` 接管 pi 内置 compaction。

**Three-phase strategy**:
1. **Phase 0 (segmenter)**: 按 turn 边界分段，每段 ~15 turns
2. **Phase 1 (summarizer)**: 并行 LLM 调用生成精简摘要 + 相关性判断
3. **Phase 2 (merger)**: 合并相关段摘要为最终 compaction summary

**Key design**:
- Enhanced `serializeConversation` with thinking truncation (500 chars) and tool result truncation
- Configurable segment model (cheap/fast model for Phase 1, session model for Phase 2)
- Graceful fallback to pi built-in compaction on error

**Commands**: `/smart-compact`, `/smart-compact-config`

**Dependencies**: pi-coding-agent (ExtensionAPI, types, serializeConversation), pi-ai (completeSimple)

| Extension | Role | Tools | Commands | Events |
|-----------|------|-------|----------|--------|
| context | Context window management (3-layer: processor → distill → aging) | — | `/context`, `/record`, `/distill-config`, `/processor-config`, `/aging-config` | `tool_result`, `context` |
| shepherd | Rule-based hook engine (block/rewrite/notify/steer) | — | — | `before_provider_request`, `session_start`, `agent_start`, `agent_end`, `session_shutdown`, `input` |
| mcp-lite | MCP tool bridge (vision, web search, GitHub) | Dynamic (from MCP servers) | `/mcp-refresh`, `/mcp-status` | `session_shutdown` |
| scheduler | In-session timers and reminders | `schedule` | `/loop`, `/remind`, `/tasks` | `session_start`, `session_shutdown`, `before_agent_start` |
| subagent | Sub-agent execution (spawn pi child process) | `subagent` | `/subagent-model` | — |
| notification | Completion sound/notification | — | — | `agent_end` |
| roadmap | Epic→Story→Task plan management with global/project sync, auto-injection, decomposition prompts | `roadmap_list`, `roadmap_show`, `roadmap_plan`, `roadmap_next`, `roadmap_done` | — | `before_agent_start` |
| workflow | Barrel re-export of workflow-core (not a real extension) | — | — | — |
| journal | Work journal (WIP, no tools/commands yet) | — | — | — |

### Shared Libraries

| Library | Exports | Consumers |
|---------|---------|-----------|
| shared-utils | `getSettingsValue`, `scanMemoryDir`, `parseFileName`, `truncatedResult`, `discoverAgents`, `getAgentDescription`, `getSettingsSection`, `patchSettingsSection`, `setSettingsValue` | context, env-and-status, memory, shepherd, session-analyzer, plan-verify, subagent, journal |
| workflow-core | `runSubagent`, `registerWorkflowTool`, `createStateManager`, `createUIUpdater`, `createSubagentWidget`, `saveSubagentOutput`, `loadAgentDef`, `setSessionFileResolver` | plan-verify, subagent |
| shepherd (lib) | `getMatchTargets`, `ruleMatches`, `pushWarning`, `notifySummary`, `hasWarnings`, `StateTracker`, `checkLineCount`, `registerToolCall`, `registerToolResult`, `drainHints`, `peekHints` | shepherd (ext) |

## Dependency Direction

```
Extensions → lib/* → pi-coding-agent (host)
Extensions → @modelcontextprotocol/sdk (external)
Extensions ∤ Extensions (no direct cross-extension imports)
```

Key rules:
- Extensions never import from other extensions directly
- Cross-extension communication only via `pi.events` event bus
- Shared libraries (`lib/*`) have no extension dependencies
- `lib/shepherd` and `lib/workflow-core` are the heaviest shared libs

## Main Execution Flows

### Flow 1: Tool Result Processing (context)

```
LLM calls tool → pi emits tool_result event
  → context/index.ts: registerToolResultProcessor()
    → tool-result-processor.ts: processToolResult()
      → unwrapDoubleEncodedJson()
      → formatter chain: [webSearch, gh, webRead, bash, mcpError]
      → truncate if exceeds token threshold
      → return formatted+truncated text
  → context/index.ts: context event handler
    → distill-helpers.ts: check token threshold
    → if over threshold: emit ephemeral:hint
    → aging: track send count, remove stale entries
```

### Flow 2: Shepherd Hook Processing

```
pi emits tool_call event
  → shepherd/index.ts: before_provider_request handler
    → lib/shepherd rules.ts: ruleMatches() against tool name, args
    → actions: block | rewrite | notify | steer
  → pi emits tool_result event
    → registerToolResult() processes result against rules
  → pi emits agent_end event
    → drainHints(), notifySummary() for ephemeral warnings
```

### Flow 3: Plan-Verify Workflow

```
User calls pv tool with action="explore"
  → plan-verify/handlers/index.ts: registerWorkflowTool()
  → state machine: explore → plan → review-plan → fix-plan →
                    write-test → review-test → execute → run-test → simplify → run-test
  → each action spawns subagent via workflow-core/runSubagent()
  → state persisted to session file
```

### Flow 4: MCP Tool Discovery

```
pi session_start event
  → mcp-lite/index.ts: setupMcpLite()
    → read config from ~/.pi/agent/extensions/mcp-lite/config.json
    → connect to MCP servers (StreamableHTTP/SSE/Stdio)
    → discover tools → pi.registerTool() for each
  → session_shutdown: close connections
```

### Flow 5: Roadmap Plan Management

```
pi emits before_agent_start event
  → roadmap/index.ts: hook handler
    → injector.ts: scan ~/.pi/roadmap/*.roadmap.json
    → progress.ts: calculate progress per roadmap
    → return { systemPrompt: overview + next-task suggestions }

User calls roadmap_plan tool
  → tools-plan.ts: validate + write JSON
    → store.ts: writeRoadmap() to ~/.pi/roadmap/<id>.roadmap.json
    → prompts loaded from prompts/*.md for decomposition guidance

User calls roadmap_done tool
  → tools-action.ts: markTaskDone()
    → store.ts: read + update + write
    → sync.ts: if project-level, sync back to global
```

## Side-Effect Boundaries

| Boundary | Extensions | Mechanism |
|----------|-----------|-----------|
| File I/O (read) | context, session-analyzer, payload-analyzer, memory, roadmap | Direct fs reads from `~/.pi/agent/`, `~/.pi/roadmap/`, `/tmp/pi-distill/` |
| File I/O (write) | memory, roadmap | Writes to `~/.pi/agent/memory/`, `<project>/.pi/memory/`, `~/.pi/roadmap/`, `<project>/.pi/roadmap/` |
| Network (LLM API) | mcp-lite | GLM API calls (vision, web search) |
| Network (MCP) | mcp-lite | MCP server connections |
| Shell/CLI | env-and-status | Executes external CLI tools |
| Child process | subagent, plan-verify | Spawns pi child processes |
| System notification | notification | OS desktop notification |
| Config mutation | context, env-and-status, shepherd | `patchSettingsSection()`, `setSettingsValue()` |
| Event bus | context → shepherd | `pi.events.emit("ephemeral:hint")` |

## Observed Inconsistencies

- **workflow extension**: Re-exports workflow-core but is listed as a pi extension in package.json. Its `export default function noop()` is a workaround. Should be treated as a shared library.
- **context is both lib and extension**: Most complex extension at ~2500 lines. Internal code is well-structured but the module is large enough to warrant its own library extraction.
- **shepherd duality**: Exists as both `extensions/shepherd/` (runtime hooks) and `lib/shepherd/` (core engine). Tests in the extension import from the lib.

## Confidence Notes

- Architecture style: **high** — clearly plugin-based
- Dependency directions: **high** — verified by import analysis
- Event flows: **medium** — inferred from code, not runtime-observed
- Side-effect boundaries: **high** — grep-verified
