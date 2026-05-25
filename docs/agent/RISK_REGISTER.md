# Risk Register

Status: current
Evidence: observed
Last validated: 2025-05-22

## Risk Matrix

| ID | Severity | Area | Description | Mitigation |
|----|----------|------|-------------|------------|
| R1 | **High** | context/tool-result-processor | Formatter chain uses positional sniffing without semantic validation. Wrong formatter can match first, producing garbage output. **Already caused a bug** (non-web_search data matched web_search formatter). | Fixed in commit b889571 (added `results.some(r => r.link \|\| r.title)` check). Pattern should be applied to all formatters. |
| R2 | **High** | context/shared.ts | Distill manifest at `/tmp/pi-distill/manifest.json` is OS-session scoped. System reboot loses all distill state, causing re-processing of all tool results. | Accepted risk. Distill is a performance optimization, not correctness-critical. |
| R3 | **Medium** | mcp-lite | MCP server connections are session-scoped with no reconnection logic. Network interruption kills tool availability until session restart. | Monitor; add reconnect if reports increase. |
| R4 | **Medium** | mcp-lite/response-processor.ts | Double-encoded JSON (`"\"escaped\""` pattern) is unwrapped by heuristic (`startsWith('"')`). Could falsely unwrap legitimate strings. | Low probability; real-world MCP responses rarely start with `"`. |
| R5 | **Medium** | shepherd | 31 rules evaluated linearly on every `tool_call` event. Performance degrades with rule additions. O(n) per tool call. | Current count (31) is manageable. Consider rule indexing if count exceeds ~100. |
| R6 | **Medium** | plan-verify | State machine transitions are implicit (string matching on Phase). No compile-time guarantee that transitions are valid. | TypeScript discriminated unions could help, but refactoring cost is high. |
| R7 | **Low** | shared-utils/settings.ts | Settings access via `getSettingsSection` has no schema validation. Malformed settings.json causes runtime errors. | Type assertions in code; no runtime validation. |
| R8 | **Low** | context | `lastContextMessages` and `lastProviderPayload` cached in module globals. Multiple concurrent pi sessions would share state incorrectly. | pi runs one session per process, so safe in practice. |
| R9 | **Low** | scheduler | Timer state is in-memory only. Session crash loses all active timers. | Accepted; timers are convenience features, not data-critical. |
| R10 | **Low** | extensions/workflow | `subagent-spawn-visible.ts` uses tmux directly (50+ lines of tmux I/O). Fragile to tmux version changes. | Isolated in one file; tmux is stable. |
| R11 | **Medium** | roadmap | AI-generated JSON may be malformed, corrupting roadmap files. | validator.ts validates all writes; repairRoadmap() attempts recovery; git version control as last resort. |
| R12 | **Low** | roadmap | `before_agent_start` injection grows with roadmap count. Could exceed token budget. | injector.ts limits to overview mode (~200 tokens); archived roadmaps excluded; detail via on-demand `roadmap_show`. |
| R13 | **Low** | roadmap | Project-level roadmap can diverge from global if edited independently. | sync.ts derives from global on every read; project-level is not a source of truth. |

## Swallowed Errors Audit

Pattern: bare `catch {}` or `catch { /* ignore */ }` blocks.

| Area | Count | Assessment |
|------|-------|-----------|
| context/shared.ts | 7 | All on file I/O init (manifest recovery, cache reads). Safe — degraded gracefully. |
| mcp-lite | 8 | Connection errors, JSON parse. Acceptable — MCP is best-effort. |
| payload-analyzer | 5 | JSON parsing of recordings. Safe — recordings may be incomplete. |
| plan-verify | 4 | State file I/O. Acceptable — state is advisory. |
| shepherd | 3 | Event processing. Safe — hooks must not crash the host. |
| env-and-status | 2 | Environment injection. Safe — read-only operations. |
| workflow (subagent) | 15+ | tmux I/O, temp file cleanup. Acceptable — cleanup is best-effort. |
| session-analyzer | 8 | Session file reads. Safe — sessions may be corrupted. |

**Verdict**: Most swallowed errors are in I/O boundaries where failure is expected and non-critical. The pattern is appropriate for this plugin architecture.

## Technical Debt

| ID | Area | Description | Priority |
|----|------|-------------|----------|
| D1 | tool-result-processor | 16 pre-existing test failures in `tool-result-processor.test.ts` (on main branch) | High |
| D2 | formatters-errors | `formatters-errors.test.ts` has stale import paths (0 tests run) | Medium |
| D3 | workflow extension | `extensions/workflow/` is a barrel re-export, not a real extension. Its `export default function noop()` is a workaround. | Low |
| D4 | context size | context extension is ~2500 lines across 15+ files. Could benefit from further library extraction. | Low |

## Test Coverage Assessment

| Module | Test Files | Status |
|--------|-----------|--------|
| context | 8 test files, 104 formatter tests passing | ✅ Good (16 tool-result-processor tests pre-existing failures) |
| shepherd | 5 test files | ✅ Good |
| plan-verify | 5+ test files | ✅ Good |
| mcp-lite | 1 test file | ⚠️ Minimal (MCP client only) |
| memory | 2 test files | ✅ Good |
| session-analyzer | 3+ test files | ✅ Good |
| env-and-status | 3 test files | ✅ Good |
| scheduler | 0 test files | ❌ None |
| subagent | 0 test files | ❌ None |
| payload-analyzer | 0 test files | ❌ None |
| notification | 0 test files | ❌ None (trivial extension, acceptable) |
| roadmap | 5 test files, 53 tests | ✅ Good (store, validator, parser, planner, sync, injector) |
