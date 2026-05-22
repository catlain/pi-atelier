# Consolidation Review

Status: current
Evidence: observed
Last validated: 2025-05-22

## Duplication Analysis

### D1: Memory Parsing — ✅ Already extracted
`lib/shared-utils/src/memory-parser.ts` shared by memory and smart-context extensions. No duplication.

### D2: Shepherd Rules Engine — ✅ Already extracted
`lib/shepherd/` shared by shepherd extension and tests. No duplication.

### D3: Workflow Core — ✅ Already extracted
`lib/workflow-core/` shared by plan-verify, subagent, and workflow extensions. No duplication.

### D4: File I/O Error Handling — Acceptable
Many `try { readFileSync(...) } catch {}` patterns across extensions. Each is context-specific (different paths, different fallbacks). Extracting a shared "safeReadFile" would over-abstract.

### D5: Tool Name String Constants — ⚠️ Minor
Tool names like `"bash"`, `"read"`, `"grep"` appear as string literals in:
- `extensions/context/tool-result-processor-core.ts` (processor matching)
- `extensions/context/toolcall-args-truncator.ts` (arg truncation)
- `extensions/shepherd/rules.json` (rule matching)

Not a significant duplication risk (3 occurrences each, unlikely to diverge).

### D6: JSON.parse in Formatters — ✅ Acceptable
Each formatter wraps its own `JSON.parse` in try/catch. This is correct — each formatter has different expected types and error handling. No extraction needed.

## Architecture Gaps

### G1: No Integration Test Suite
Unit tests per extension are good, but no cross-extension integration tests. For example:
- Shepherd rules + context processor interaction
- MCP tool registration → tool call → result processing pipeline
- Plan-verify → subagent → session file creation

**Risk**: Medium. Cross-cutting bugs (like the formatter mis-match) escape unit tests.

### G2: No Schema Validation for Settings
Settings are accessed via `getSettingsSection()` with TypeScript type assertions but no runtime validation. Malformed settings could cause runtime errors in extensions.

**Risk**: Low. Settings are only written by the extensions themselves.

### G3: Formatter Chain Not Configurable
Formatter order is hardcoded in `formatters.ts`. Users cannot customize or disable formatters.

**Risk**: Low. Current order is correct; configurability would add complexity.

### G4: No Shared Test Utilities
Each extension creates its own test helpers (mock ExtensionAPI, temp directories, etc.). Some duplication in test setup code.

**Risk**: Very Low. Test code duplication is tolerable.

## Naming and Organization

| Concern | Status | Notes |
|---------|--------|-------|
| Consistent file naming | ✅ | `kebab-case.ts` throughout |
| Test placement | ⚠️ Mixed | Some in `tests/` subdir, some alongside source. No strict convention. |
| Extension directory structure | ✅ | All have `index.ts` as entry, `package.json`, `tsconfig.json` |
| Library structure | ✅ | All have `src/index.ts`, build to `dist/` |

## Recommendations

1. **Priority High**: Fix 16 pre-existing test failures in tool-result-processor tests
2. **Priority Medium**: Add integration test for formatter chain with cross-format data
3. **Priority Low**: Standardize test directory convention (all under `tests/`)
4. **Priority Low**: Consider shared test utilities package
