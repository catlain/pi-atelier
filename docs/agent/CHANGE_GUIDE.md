# Change Guide

Status: current
Evidence: observed
Last validated: 2025-05-22

## How to Make Changes Safely

### Adding a New Formatter

1. Create `extensions/context/formatters-<name>.ts`
2. Implement: `(text: string) => string` — return original text on mismatch
3. Import and add to formatter chain in `formatters.ts` — **position matters** (first match wins)
4. Add semantic validation: check for specific field names, not just "is array"
5. Add tests in `formatters-<name>.test.ts`:
   - Correct data formatted properly
   - Wrong data type returns original
   - Other extension's data is not falsely matched
6. Run: `npx vitest run extensions/context/formatters.test.ts`

### Adding a New Extension

1. Create `extensions/<name>/` directory
2. Create `index.ts` with default export: `(api: ExtensionAPI) => void`
3. Register tools via `api.registerTool()`, commands via `api.registerCommand()`
4. Add event listeners via `api.on()`
5. If shared logic needed, create library in `lib/<name>/` (no pi dependency)
6. Add to root `package.json` workspaces if needed
7. Test with `npx vitest run extensions/<name>/`

**Example: smart-compact** — Event-based compaction override:
- Listens on `session_before_compact`, returns `CompactionResult` to take over
- Commands: `/smart-compact`, `/smart-compact-config`
- Multi-phase LLM calls via `completeSimple` from `@earendil-works/pi-ai`
- Config via `loadConfig()` with `SmartCompactConfig` defaults

### Adding a Shepherd Rule

1. Edit `extensions/shepherd/rules.json`
2. Add rule object: `{comment, tool, action, pattern, flags, reason, enabled}`
3. `tool` is a glob pattern matching tool name
4. `pattern` is a regex matching tool args
5. Rules evaluated in array order; first match wins
6. Test with `npx vitest run extensions/shepherd/tests/rules.test.ts`

### Modifying Tool Result Processing

**Critical path**: `tool-result-processor-core.ts` → `formatters.ts` → individual formatters

1. **Never** change formatter chain order without testing all formatter pairs
2. **Always** add semantic validation (check field names, not just types)
3. Run full formatter test suite after changes
4. Test with real MCP tool outputs when possible

### Modifying Plan-Verify Workflow

1. State machine phases defined in `extensions/plan-verify/types.ts`
2. Phase transitions in `extensions/plan-verify/index.ts` `handlePhase()`
3. Subagent prompts in `extensions/plan-verify/prompts.ts` and `orchestrator.ts`
4. Run: `npx vitest run extensions/plan-verify/tests/`

### Modifying MCP Integration

1. Connection logic: `extensions/mcp-lite/mcp-client.ts`
2. Tool definition building: `extensions/mcp-lite/tool-builder.ts`
3. Response processing: `extensions/mcp-lite/response-processor.ts`
4. Config at `~/.pi/agent/extensions/mcp-lite/config.json`
5. Test: `npx vitest run extensions/mcp-lite/`

## Testing Strategy

```bash
# Quick: formatter tests only
npx vitest run extensions/context/formatters.test.ts extensions/context/formatters-web.test.ts

# Medium: single extension
npx vitest run extensions/context/

# Full: everything
npx vitest run

# Type check only
npx tsc --noEmit
```

## Known Pre-existing Failures

| Suite | Failing Tests | Root Cause |
|-------|--------------|------------|
| `tool-result-processor.test.ts` | 16 failures | Pre-existing on main branch; stale test expectations |
| `formatters-errors.test.ts` | 0 tests run | Stale import paths |

These are **not regressions** from recent work. Fix separately.
