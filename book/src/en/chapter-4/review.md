# Teaching AI to Review

## You've Probably Been in This Situation

You ran a 3-hour session where the AI helped you do a lot:

- Fixed two bugs
- Refactored a module
- Configured a CI pipeline
- Wrote a bunch of tests

The next day you want to recap: "How exactly was that login bug fixed yesterday?" But all you have is a vague memory — was it `auth.ts` or `middleware.ts` that was changed? Was it a null check added or a type assertion changed?

You search through git log, and the commit message reads "fix: update auth" — which tells you nothing.

> 💡 **The AI did a lot, but no one recorded the "why."** Git only captures what changed, not the thought process behind it.

## Two Tools: Journal and Session Analyzer

pi-atelier provides two complementary tools to solve this problem:

### pi-journal — Automatic Recording

Journal quietly records key events from each session in the background:

- Which files were read
- Which files were modified
- What key decisions the AI made
- Session start and end times

```
┌───────────────────────────────────────┐
│         AI Session In Progress        │
│                                       │
│  Read src/auth.ts     → Journal logs  │
│  Modify src/auth.ts   → Journal logs  │
│  Run npm test         → Journal logs  │
│  Commit git commit    → Journal logs  │
│                                       │
│  Session ends → Daily summary         │
└───────────────────────────────────────┘
```

### pi-session-analyzer — Deep Retrospection

Session Analyzer lets you search and analyze historical sessions:

| Feature | Description |
|---------|-------------|
| Cross-session search | Keyword search across all historical session content |
| Search by file | Find all sessions that modified a specific file |
| Timeline view | View the complete process of a session in chronological order |
| Summary generation | Automatically summarize what a session accomplished |
| Branch analysis | Analyze parallel branches created by `/tree` |

## Real-World Example: Finding Last Week's Bug Fix

### Scenario: Cross-Session Search

You say: "Help me find the session where we fixed the DuckDB timezone issue."

AI calls `session_search`:

```
🔍 Searching "DuckDB timezone" — Found 2 matching sessions:

1. 05-22 19:36 — DuckDB timezone configuration fix
   Modified src/db/connection.ts

2. 05-20 14:30 — Database initialization discussion
   Discussed timezone strategy but didn't change code
```

### Scenario: Viewing Session Details

You say: "Show me the detailed process of the first session."

AI calls `session_analyze`, generating a timeline:

```
📅 Session Timeline (05-22 19:36)

[19:36] User: DuckDB queries return UTC time, need to change to China timezone
[19:37] AI: Read db/connection.ts
[19:38] AI: Found that no timezone parameter was set on connection
[19:39] AI: Modified connection.ts, added SET timezone = 'Asia/Shanghai'
[19:40] AI: Ran tests, 2 tests failed
[19:41] AI: Found that test mocks don't have timezone configuration
[19:42] AI: Modified test mock
[19:43] AI: All tests passed ✅
[19:44] AI: Committed git commit "fix: set DuckDB timezone to Asia/Shanghai"
```

### Scenario: Tracking by File

You say: "Who modified connection.ts recently?"

AI calls `session_search` in `file` mode:

```
📄 Modification history for src/db/connection.ts:

1. 05-22 19:36 — DuckDB timezone fix (you)
2. 05-20 14:30 — Database connection pool configuration (colleague)
3. 05-18 09:15 — Initial creation (you)
```

## Journal Output Format

Journal logs are stored in the `.pi/journal/` directory:

```
.pi/journal/
├── 2026-05-22.md        # Daily log
├── 2026-05-21.md
└── summaries/
    ├── weekly-2026-W21.md  # Weekly summary
    └── daily/              # Daily summaries
```

Example daily log content:

```markdown
# 2026-05-22 Work Log

## Session 1: DuckDB timezone fix (19:36 - 19:44)

- Modified: src/db/connection.ts
- Modified: tests/db/connection.test.ts
- Decision: Set timezone at the connection layer, not the SQL layer
- Tests: All passed

## Session 2: API documentation (20:15 - 21:30)

- Created: docs/api/auth.md
- Created: docs/api/users.md
- Modified: docs/api/index.md
```

## Session Analyzer Analysis Dimensions

| Mode | Purpose | Example Command |
|------|---------|-----------------|
| `summary` | Session overview | "What did this session do?" |
| `entries` | Event-by-event listing | "List all file modifications" |
| `timeline` | Timeline view | "What was the order of AI operations?" |
| `chain` | Sub-agent tracing | "What did the sub-agent do?" |
| `audit` | Audit check | "Were there any policy violations?" |
| `digest` | Conversation sequence | "What did I discuss with the AI?" |
| `takeover` | Handover report | "Help me take over the last session's work" |

### The Most Useful Mode: takeover

`takeover` generates a "handover report" covering 5 dimensions:

```
📋 Session Handover Report

1. User intent: Fix DuckDB timezone issue
2. Modified files: connection.ts, connection.test.ts
3. Recent steps: Modified test mock, tests passed
4. Next steps: Consider whether to document timezone behavior
5. Key decisions: Chose to handle timezone at the connection layer rather than the SQL layer
```

When you want to "continue from where you left off," this report helps you (or another AI) quickly restore context.

## Best Practices

### ✅ Getting the Most Out of Journal

- **Commit frequently**: Journal event granularity aligns with git commits
- **Review regularly**: Use `session_search` weekly to recap what you've done
- **Combine with Memory**: Journal records "what was done," Memory records "what was learned"

### ✅ Efficient Use of Session Analyzer

- **`grep` mode**: Search keywords across all historical sessions (much faster than digging through git log)
- **`file` mode**: Find all sessions that touched a specific file (great for code review)
- **`takeover` mode**: Generate a handover report when taking over someone else's work

### ❌ Common Pitfalls

- Don't treat Journal as Memory — Journal is a log (what happened), Memory is knowledge (what was learned)
- Don't look for code content in Journal — Journal records operations only, not full code text

## Next Steps

With review capabilities, both you and the AI can look back at past work. But there's still one problem: the longer a session runs, the more the AI tends to "get dumber" — repeating itself and forgetting earlier agreements.

In the next chapter, we'll look at how to keep the AI sharp during long sessions.
