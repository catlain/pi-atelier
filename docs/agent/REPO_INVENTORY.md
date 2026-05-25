# Repository Inventory

Status: current
Evidence: observed
Last validated: 2025-05-22

## Project Summary

**pi-atelier** — Extension forge for [pi-coding-agent](https://github.com/earendil-works/pi-coding-agent). TypeScript monorepo with 14 extensions + 4 shared libs, providing tools, workflows, and utilities for AI coding agent.

- **Language**: TypeScript (ES2022, strict)
- **Package manager**: npm workspaces
- **Test framework**: Vitest
- **Runtime**: Node.js (loaded by pi as extensions)
- **Total**: ~170 source files, ~85 test files, ~32K lines

## Build/Test Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install all workspace deps |
| `npx vitest run` | Run all tests (excludes `.subagent.test.ts`) |
| `npx vitest run extensions/<name>/...test.ts` | Run specific test file |
| `npx tsc --noEmit` (per extension) | Type check |
| No build step | pi loads `.ts` directly via jiti |

**Note**: `.subagent.test.ts` files spawn child processes and are excluded from `npx vitest run`. Run them individually.

## Entry Points

Each extension has `index.ts` exporting a default `function(pi: ExtensionAPI)`.

| Extension | Entry | Registers |
|-----------|-------|-----------|
| context | `extensions/context/index.ts` | Commands: `/context`, `/record`, `/distill-config`, `/processor-config`, `/aging-config`; Event handlers: `tool_result`, `context` |
| env-and-status | `extensions/env-and-status/index.ts` | Commands: (none registered); Events: `session_start`, `turn_start`, `tool_call`, `before_agent_start` |
| journal | `extensions/journal/index.ts` | Factory export (WIP) |
| mcp-lite | `extensions/mcp-lite/index.ts` | Tools: vision/web tools (dynamic); Commands: `/mcp-refresh`, `/mcp-status`; Event: `session_shutdown` |
| memory | `extensions/memory/index.ts` | Tools: `memory_index`, `memory_update` |
| notification | `extensions/notification/index.ts` | Event: `agent_end` |
| payload-analyzer | `extensions/payload-analyzer/index.ts` | Tool: `payload_analyze` |
| plan-verify | `extensions/plan-verify/index.ts` | Tool: `pv`; Events: `before_agent_start`, `context`, `session_start` |
| roadmap | `extensions/roadmap/index.ts` | Tools: `roadmap_list`, `roadmap_show`, `roadmap_plan`, `roadmap_next`, `roadmap_done`; Event: `before_agent_start` |
| scheduler | `extensions/scheduler/index.ts` | Tool: `schedule`; Commands: `/loop`, `/remind`, `/tasks`; Events: `session_start`, `session_shutdown`, `before_agent_start` |
| session-analyzer | `extensions/session-analyzer/index.ts` | Tools: `session_search`, `session_analyze` |
| shepherd | `extensions/shepherd/index.ts` | Events: `before_provider_request`, `session_start`, `agent_start`, `agent_end`, `session_shutdown`, `tool_call`, `tool_result` |
| subagent | `extensions/subagent/index.ts` | Tool: `subagent`; Command: `/subagent-model` |
| workflow | `extensions/workflow/index.ts` | No-op barrel export (shared library, not a real extension) |

## Major Directories

```
pi-atelier/
├── extensions/          # 13 pi extensions (each is a workspace package)
│   ├── context/         # Context management (processor/distill/aging)
│   ├── env-and-status/  # Environment injection + status management
│   ├── journal/         # Work journal (WIP)
│   ├── mcp-lite/        # MCP tool bridge
│   ├── memory/          # Persistent memory
│   ├── notification/    # Completion notifications
│   ├── payload-analyzer/# Token cost analysis
│   ├── plan-verify/     # SDD+TDD workflow (pv tool)
│   ├── roadmap/         # Epic→Story→Task plan management
│   ├── scheduler/       # In-session timers
│   ├── session-analyzer/# Session search/analysis
│   ├── shepherd/        # Rule-based hook engine
│   ├── subagent/        # Sub-agent management
│   └── workflow/        # Workflow engine (barrel export)
├── lib/                 # 4 shared libraries (workspace packages)
│   ├── shared-utils/    # Paths, types, helpers (8 consumers)
│   ├── workflow-core/   # State machine, Gate, subagent dispatch
│   ├── shepherd/        # Rule engine core (shared by shepherd ext)
├── docs/agent/          # Architecture docs (this recon)
├── tsconfig.base.json   # Shared TS config + path aliases
├── vitest.config.ts     # Root test config (excludes subagent tests)
└── package.json         # Workspace root
```

## External Dependencies/Boundaries

| Dependency | Type | Used By |
|------------|------|---------|
| `@earendil-works/pi-coding-agent` | Host platform | All extensions (ExtensionAPI) |
| `@modelcontextprotocol/sdk` | MCP protocol | mcp-lite |
| `@sinclair/typebox` | Schema validation | memory, session-analyzer, journal, payload-analyzer, roadmap |
| GLM API | External API (optional) | mcp-lite (vision, web search) |
| `~/.pi/agent/` | Config/data directory | All extensions |
| `~/.pi/agent/sessions/` | Session JSONL files | session-analyzer |
| `~/.pi/roadmap/` | Roadmap JSON files (global) | roadmap |
| `<project>/.pi/roadmap/` | Roadmap JSON (project-level sync) | roadmap |
| `/tmp/pi-distill/` | Temp files (recordings) | context, payload-analyzer |

## Unknowns

- journal extension is WIP — no tools/commands registered
- `workflow` extension is a barrel re-export, not a real extension — may confuse tooling
- subagent tests require spawning pi child processes (excluded from default test run)
- No CI/CD pipeline observed

## Next Recommended Analysis Targets

- Dependency graph between extensions and shared libs
- Event flow: which extensions emit/consume which pi events
- Shepherd rule lifecycle and cross-extension `ephemeral:hint` protocol
