# Architecture Decision Records

## ADR-001: Formatter Chain for Tool Result Processing

**Status**: Accepted (2025-05)
**Context**: Tool results from MCP servers (web search, GitHub) vary widely in format. The context extension needs to compress/format these results to save context tokens.
**Decision**: Use a sequential formatter chain where each formatter sniffs the input and either formats it or passes it to the next. First match wins.
**Consequences**:
- ✅ Easy to add new formatters without modifying existing ones
- ✅ Each formatter is a pure function, independently testable
- ⚠️ Order matters — must ensure more specific formatters come before general ones
- ⚠️ Risk of false matches if formatters don't validate semantics (bug fixed in b889571)

## ADR-002: Extension Isolation via Event Bus

**Status**: Accepted (2025-05)
**Context**: Extensions need to communicate (e.g., context→shepherd for ephemeral hints) but direct imports create coupling.
**Decision**: Extensions communicate only via `pi.events` event bus and shared settings file. No cross-extension imports.
**Consequences**:
- ✅ Extensions can be added/removed independently
- ✅ No circular dependency risk
- ⚠️ Type safety lost at event boundaries (any payload)
- ⚠️ Debugging event flows requires tracing event names

## ADR-003: Subagent Pattern for Complex Workflows

**Status**: Accepted (2025-05)
**Context**: Plan-verify workflow needs to run code exploration, planning, review, and execution in isolated contexts with different system prompts.
**Decision**: Spawn child pi processes as subagents, each with its own agent definition (system prompt), model, and session file.
**Consequences**:
- ✅ Full isolation between phases
- ✅ Each subagent can use a different model
- ⚠️ Overhead of spawning child processes (~2-5s per subagent)
- ⚠️ Complex session file management (parent→child linking)

## ADR-004: MCP Lite over pi-mcp-adapter

**Status**: Accepted (2025-05)
**Context**: Need MCP tool integration. pi-mcp-adapter exists but has issues.
**Decision**: Build mcp-lite as a lightweight replacement with lazy connection, tool caching, and built-in response processing.
**Consequences**:
- ✅ Faster startup (lazy connect vs eager)
- ✅ Tool definitions cached between sessions
- ✅ Integrated response processor for MCP-specific formats
- ⚠️ Diverges from upstream pi-mcp-adapter

## ADR-005: File-Based Memory with Filename Metadata

**Status**: Accepted (2025-05)
**Context**: AI agent needs persistent memory across sessions. Memory entries need topic and keyword metadata for search.
**Decision**: Encode metadata in filenames (`topic--kw1,kw2,kw3.md`), with a `MEMORY.md` index file.
**Consequences**:
- ✅ Human-readable, git-friendly
- ✅ No database dependency
- ⚠️ Filename parsing is fragile (must handle edge cases)
- ⚠️ 80-line limit per file requires active maintenance

## ADR-006: Three-Layer Context Management

**Status**: Accepted (2025-05)
**Context**: LLM context windows fill up with tool results. Need strategies to manage growth.
**Decision**: Three layers: (1) Processor — format/compress on tool return, (2) Distill — remove oversized results before sending, (3) Aging — remove old results after N rounds.
**Consequences**:
- ✅ Progressive defense: compress → distill → forget
- ✅ Each layer independently configurable
- ⚠️ Complex interaction between layers (aging skips distill-processed entries)
- ⚠️ Token counting is approximate (character-based estimation)
