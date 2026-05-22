# Dependency Rules

Status: current
Evidence: observed
Last validated: 2025-05-22

## Layer Diagram

```
┌─────────────────────────────────────────────┐
│  Host Layer: pi-coding-agent                │
│  Provides ExtensionAPI (registerTool, on,   │
│  registerCommand, events)                   │
├─────────────────────────────────────────────┤
│  Extension Layer: extensions/*               │
│  Consume ExtensionAPI, import from lib/*    │
├─────────────────────────────────────────────┤
│  Library Layer: lib/*                        │
│  Pure logic, no pi imports                  │
├─────────────────────────────────────────────┤
│  External: typebox, @modelcontextprotocol   │
└─────────────────────────────────────────────┘
```

## Allowed Dependencies (by layer)

### Extensions →
| Target | Examples | ✅ Allowed |
|--------|----------|-----------|
| pi host | `@earendil-works/pi-coding-agent` | ✅ ExtensionAPI type only |
| Shared libs | `@pi-atelier/shared-utils`, `@pi-atelier/workflow-core`, `@pi-atelier/shepherd` | ✅ |
| Node stdlib | `fs`, `path`, `os`, `child_process`, `crypto` | ✅ |
| External | `typebox`, `@modelcontextprotocol/sdk` | ✅ |
| Same-extension | `./shared`, `./commands`, etc. | ✅ |
| Other extensions | `@pi-atelier/context` from memory | ❌ **FORBIDDEN** |

### Libraries (lib/*) →
| Target | ✅ Allowed |
|--------|-----------|
| Node stdlib | ✅ |
| Other @pi-atelier libs | ❌ **FORBIDDEN** (verified: zero cross-imports) |
| pi host | ❌ **FORBIDDEN** |
| Extensions | ❌ **FORBIDDEN** |

### Libraries (lib/*) ←
| Consumer | ✅ Allowed |
|----------|-----------|
| Extensions | ✅ |
| Other libs | ❌ |

## Verified Import Map

### External dependencies consumed
| Package | Consumers |
|---------|-----------|
| `@earendil-works/pi-coding-agent` | All extensions (type only) |
| `typebox` / `@sinclair/typebox` | memory, session-analyzer, payload-analyzer, subagent |
| `@modelcontextprotocol/sdk` | mcp-lite |

### Shared library consumers
| Library | Consumed by |
|---------|-------------|
| `@pi-atelier/shared-utils` | context, env-and-status, memory, shepherd, session-analyzer, plan-verify, subagent, journal |
| `@pi-atelier/workflow-core` | plan-verify, subagent |
| `@pi-atelier/shepherd` | shepherd (ext) |

## Cross-Extension Communication

Extensions **never** import each other directly. Communication channels:

| Channel | Direction | Mechanism |
|---------|-----------|-----------|
| Ephemeral hints | context → shepherd | `pi.events.emit("ephemeral:hint")` → `pi.events.on("ephemeral:hint")` |
| Settings file | any → any | Write via `patchSettingsSection`, read via `getSettingsSection` |
| Shared state files | any → any | `/tmp/pi-distill/` temp files (fragile, only context↔shepherd) |

## Rule Enforcement

These rules are **not enforced by tooling** (no ESLint dependency constraints). Violations are caught by:
1. TypeScript compilation errors (if import paths wrong)
2. Code review
3. This document

## Known Violations

None found. All imports verified clean.
