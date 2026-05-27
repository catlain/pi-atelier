# 4.3 pi-session-analyzer: Cross-Session Search

> pi-session-analyzer is the "time machine" of pi-atelier — it can search and analyze all historical sessions, helping you and the AI look back at what happened.

## Why Session Analysis?

Every pi conversation is recorded in JSONL files (under `~/.pi/agent/distill/`), but the raw data is not human-readable. Session Analyzer transforms this data into searchable, analyzable structured information.

Three common needs:

| Need | Solution | Example |
|------|----------|---------|
| Find a specific session | `session_search` cross-session search | "Which session was the one where I fixed DuckDB?" |
| Understand session content | `session_analyze` single-session analysis | "What exactly happened in that session?" |
| Take over someone else's work | `takeover` handover report | "Continue from where I left off last time" |

## session_search: Cross-Session Search

Three search modes:

### grep Mode — Keyword Search

Search the content of all sessions (including user messages and AI responses):

```
session_search(action="grep", query="DuckDB timezone")

Result:
  3 sessions matched:
  1. 05-22 19:36 — DuckDB timezone config fix
  2. 05-20 14:30 — Database initialization discussion
  3. 05-18 09:15 — Tech stack discussion
```

Search results include context snippets, so you can tell if a session is relevant without opening it.

**Advanced usage**: `editOnly=true` only searches sessions that contain file editing operations, filtering out pure discussion:

```
session_search(action="grep", query="settings.json", editOnly=true)

Result:
  2 sessions edited settings.json
```

This is useful for tracking.

### file Mode — Track by File

Find all sessions that modified a specific file:

```
session_search(action="file", query="src/auth/login.ts")

Result:
  3 sessions modified this file:
  1. 05-22 19:36 — Login bug fix (changed null check)
  2. 05-20 14:30 — Auth module refactoring (changed function signature)
  3. 05-18 09:15 — Initial creation
```

**Use case**: During code review, you want to know "why is this file the way it is" — each session represents a modification intent.

### list Mode — Browse Recent Sessions

List all recent sessions:

```
session_search(action="list", limit=10)

Result:
  Recent 10 sessions:
  1. 05-27 11:24 — Check what's left to do
  2. 05-27 11:08 — Payload analysis script enhancement
  3. 05-27 11:06 — Roadmap session ID display fix
  ...
```

## session_analyze: Single-Session Analysis

Session Analyzer offers multiple analysis dimensions for different needs:

> ⚠️ Note: The `action` parameter of `session_analyze` only accepts the following values; do not pass `grep`/`file`/`list` (those are `session_search` actions).

### summary — Quick Overview of a Session

```
session_analyze(action="summary", sessionId="019e6765")

Result:
  Session Summary (31 exchanges)
  User intent: Fix roadmap session ID display bug
  Key operations: Discovered formatTimestamps slice(0,8) truncation error
  Output: 2 bug fixes, 145 tests passing
```

**When to use**: When you don't know what a session is about, start with summary.

### entries — Browse Events One by One

Supports precise filtering and pagination:

```
# View the last 10 entries
session_analyze(action="entries", limit=10)

# Start from entry 20 (pagination)
session_analyze(action="entries", offset=20, limit=10)

# Filter by keyword
session_analyze(action="entries", grep="edit|write")

# Compact mode — quick browse of large sessions
session_analyze(action="entries", compact=true)
```

**When to use**:
- You want to see what specific operations the AI performed
- Search for specific types of operations in a session (e.g., all file edits)
- Quick browse of large sessions

### timeline — Timeline View

Display operations in chronological order:

```
session_analyze(action="timeline", sessionId="...")

Result:
  📅 Timeline
  [19:36] 👤 DuckDB query returns UTC time
  [19:37] 🤖 Read db/connection.ts
  [19:38] 🤖 Discovered no timezone parameter set
  [19:39] 🤖 Modified connection.ts
  [19:40] 🤖 Ran tests — 2 failures
  [19:42] 🤖 Modified test mock
  [19:43] 🤖 All tests passed ✅
```

**When to use**: When you want to understand the AI's step-by-step operations and decision process.

### chain — Sub-Agent Tracking

Track sub-agent call chains:

```
session_analyze(action="chain", sessionId="...")

Result:
  🔗 Sub-agent chain
  Main agent → pv-explorer (code exploration)
  Main agent → pv-reviewer (plan review)
  Main agent → pv-executor (execute changes)
```

**When to use**: When a session used sub-agents and you want to know what each one did.

### audit — Audit Checks

Check for rule violations in a session:

```
session_analyze(action="audit", sessionId="...")

Result:
  ⚠️ Found 2 issues:
  1. [Violation] Directly wrote settings.json instead of using patchSettingsSectionWithBackup
  2. [Warning] Large file write overwrite (>200 lines), should split
```

**When to use**:
- Check if the AI followed project conventions
- Review someone else's session for issues
- Regular quality checks

### digest — Conversation Sequence

Extract user/assistant conversation from a session, stripping tool call details and keeping only human-readable dialogue:

```
session_analyze(action="digest", sessionId="...")

Result:
  👤 Help me fix the roadmap display bug
  🤖 Sure, let me take a look at the code first...
  👤 Tests aren't passing, take a look
  🤖 Found that formatTimestamps has a truncation logic error...
```

**When to use**: When you want a quick understanding of the conversational thread between user and AI without seeing tool details.

### raw — Raw Data

View the raw JSONL records directly (10 entries max by default):

```
session_analyze(action="raw", sessionId="...", limit=5)
```

**When to use**: When none of the analysis modes above meet your needs, look at the raw data directly. Generally used for debugging or data format verification.

### branches — Branch Analysis

Analyze parallel branches created by the `/tree` command:

```
session_analyze(action="branches", sessionId="...")

Result:
  🌿 Branch Analysis
  [Main branch] Normal workflow
  [B1] Tried approach A for refactoring → Failed, returned to main branch
  [B2] Tried approach B for refactoring → Succeeded
```

**When to use**: When a session used `/tree` to create exploration branches and you want to understand the results of each branch.

## Data Storage

Session Analyzer's data sources:

```
~/.pi/agent/sessions/
├── --home-lain-.pi--/                ← Session directories grouped by CWD
│   ├── 2026-05-27T..._sessionId.jsonl  ← Complete record for each session
│   └── ...
└── --other-project-path--/          ← Sessions from different project directories
    └── ...
```

Session records are in JSONL format (one JSON object per line), containing:
- User messages
- AI responses (including tool calls and results)
- Timestamps
- Branch markers

## Next Steps

> 📖 Back to [4.1 Let AI Learn to Review](./review.md) for a complete usage example.


Original: /home/lain/.pi/agent/distill/processor/read-ed6e48fc-1779884015234.txt
