# Risk-to-Test Mapping

Status: current
Evidence: observed
Last validated: 2025-05-22

## Critical Path Tests

These tests guard against the highest-impact risks.

### R1: Formatter False Match (Risk Register R1)

**Risk**: Wrong formatter matches tool result, producing garbage output.
**Test coverage**: `formatters-web.test.ts` — 8 regression tests for cross-format false matches.
**Gap**: No integration test running the full formatter chain with all real MCP tool outputs.

```
TEST-CASE: formatter-chain-integration
  FOR EACH pair (source, formatter):
    GIVEN real output from source tool ((web_search, gh, web_read))
    WHEN passed through the complete formatter chain
    THEN only the correct formatter matches
    AND output is correctly formatted
    AND no other formatter partially matches
```

### R3: MCP Connection Loss (Risk Register R3)

**Risk**: MCP server disconnects, tools become unavailable.
**Test coverage**: `mcp-client.test.ts` — basic client tests only.
**Gap**: No test for reconnection behavior (none implemented either).

```
TEST-CASE: mcp-reconnect
  GIVEN connected MCP client
  WHEN server becomes unreachable
  THEN client attempts reconnection on next tool call
  AND tools become available again
```

### D1: Pre-existing Test Failures (Debt D1)

**Risk**: 16 failing tests in tool-result-processor mask real regressions.
**Action**: Fix or update tests before making further processor changes.

```
TEST-CASE: tool-result-processor-regression
  FOR EACH currently-failing test:
    DETERMINE if test expectation is stale or code has a bug
    FIX test or FIX code accordingly
    VERIFY all 16 tests pass
```

## Test-to-Risk Coverage Matrix

| Risk | Test File | Coverage |
|------|-----------|----------|
| R1: Formatter false match | `formatters-web.test.ts`, `formatters.test.ts` | ✅ Good (8 cross-format tests) |
| R2: Distill state loss | No test | ⚠️ Accepted (cosmetic risk) |
| R3: MCP disconnect | `mcp-client.test.ts` | ⚠️ Minimal |
| R4: Double-encode heuristic | `formatters-utils.test.ts` | ✅ Covered |
| R5: Shepherd rule perf | `rules.test.ts` | ✅ Unit tests exist |
| R6: Phase transitions | Plan-verify tests | ⚠️ Implicit only |
| R7: Settings schema | No validation test | ⚠️ None |
| R8: Shared state | No test | ⚠️ Accepted (single-process) |
| D1: Stale tests | `tool-result-processor.test.ts` | ❌ 16 failures |
| D2: Stale imports | `formatters-errors.test.ts` | ❌ 0 tests run |

## Recommended New Tests (Priority Order)

### Priority 1: Formatter Chain Integration
- File: `extensions/context/formatters-chain.integration.test.ts`
- Test all real MCP outputs through complete chain
- Verify no cross-format contamination
- Estimated: ~50 lines

### Priority 2: Fix Pre-existing Failures
- File: `extensions/context/tool-result-processor.test.ts`
- Update 16 failing tests to match current behavior
- Estimated: ~30 min investigation

### Priority 3: Fix formatters-errors Test Import
- File: `extensions/context/formatters-errors.test.ts`
- Fix import path so tests actually run
- Estimated: ~5 min fix

## Smoke Test Command

After any change, run:

```bash
npx vitest run extensions/context/ extensions/shepherd/ extensions/plan-verify/
```

This covers the three highest-risk modules. If all pass, change is safe to commit.
