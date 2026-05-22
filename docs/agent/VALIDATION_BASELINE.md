# Validation Baseline

Status: current
Evidence: observed
Last validated: 2025-05-22

## Install/Bootstrap

```bash
npm install
```

No build step. pi loads `.ts` files via jiti at runtime.

## Format/Lint

No formatter or linter configured.

## Typecheck/Build

```bash
# Per-extension typecheck (no project-wide build)
cd extensions/<name> && npx tsc --noEmit
cd lib/<name> && npx tsc --noEmit
```

**Note**: `tsconfig.base.json` has hardcoded absolute paths to pi's global install. Typecheck only works when pi is installed at the expected location.

## Test

```bash
# All tests (excludes .subagent.test.ts)
npx vitest run

# Specific extension tests
npx vitest run extensions/<name>/

# Subagent tests (run individually)
npx vitest run extensions/<name>/tests/x.subagent.test.ts
```

### Last Run Status: run (2025-05-22)

**Formatter tests**: 104/104 pass ✅
**Pre-existing failures on main branch**:
- `tool-result-processor.test.ts` and related: 16 failures (mock path issues)
- `formatters-errors.test.ts`: 2 failures (import path, `no tests`)

### Known Test Gaps

- No integration tests for MCP tool discovery pipeline
- Shepherd rule matching untested against real tool calls
- No E2E tests for full extension lifecycle
- Subagent tests excluded from CI-equivalent runs

## Runtime/Smoke

No automated smoke tests. Manual validation via `pi` session.

## Blockers

- Typecheck requires pi installed globally at specific path
- Pre-existing test failures in main branch need triage
- No CI/CD pipeline

## Next Best Checks

1. Triage 16 pre-existing test failures in `tool-result-processor.*.test.ts`
2. Fix `formatters-errors.test.ts` import paths
3. Run full typecheck across all extensions
