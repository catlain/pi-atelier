# Teaching the AI to Review

## You've Probably Experienced This

You had a 3-hour session where the AI helped you do a lot:

- Fixed two bugs
- Refactored a module
- Set up the CI pipeline
- Wrote a bunch of tests

The next day you want to review: "How exactly did I fix that login bug yesterday?" But all you have is a vague memory — was it `auth.ts` or `middleware.ts`? Did you add a null check or change a type assertion?

You dig through the git log, and the commit message reads "fix: update auth" — which is as good as nothing.

> 💡 **The AI did a lot, but nobody recorded the "why"**. Git only tracks what changed, not the thought process behind it.

## Core Tool: pi-session-analyzer

pi-atelier provides Session Analyzer to search and analyze historical sessions:

| Feature | Description |
|---------|-------------|
| Cross-session search | Search all historical sessions by keyword |
| Search by file | Find all sessions that modified a specific file |
| Timeline view | View the complete flow of a session chronologically |
| Summary generation | Auto-summarize what a session accomplished |
| Branch analysis | Analyze parallel branches created by `/tree` |
| Takeover report | 5-dimensional context to help the AI quickly resume work |
| Audit check | Check for rule violations in a session |

> 💡 **About pi-journal**: pi-journal can generate daily/weekly reports via the `/journal` command or `journal` tool, aggregating git activity, memory changes, and session activity from three data sources. See [4.2 pi-journal Principles](./journal.md) for details.

## Real-World Example: Finding Last Week's Bug Fix

### Scenario: Cross-Session Search

You say: "Help me find the session where I fixed the DuckDB timezone issue."

The AI invokes `session_search`:

```
🔍 Searching for "DuckDB timezone" — found 2 matching sessions:

1. 05-22 19:36 — DuckDB timezone config fix
   Modified src/db/connection.ts
   
2. 05-20 14:30 — Database initialization discussion
   Discussed timezone strategy but didn't change code
```

### Scenario: Viewing Session Details

You say: "Show me the detailed process of the first session."

The AI invokes `session_analyze`, generating a timeline:

```
📅 Session Timeline (05-22 19:36)

[19:36] User: DuckDB queries return UTC time, need to switch to China timezone
[19:37] AI: Read db/connection.ts
[19:38] AI: Found no timezone parameter set in the connection
[19:39] AI: Modified connection.ts, added SET timezone = 'Asia/Shanghai'
[19:40] AI: Ran tests, 2 tests failed
[19:41] AI: Found test mocks missing timezone setting
[19:42] AI: Modified test mocks
[19:43] AI: All tests passed ✅
[19:44] AI: Committed git commit "fix: set DuckDB timezone to Asia/Shanghai"
```

### Scenario: Tracking by File

You say: "Who modified connection.ts recently?"

The AI invokes `session_search` in `file` mode:

```
📄 Modification history for src/db/connection.ts:

1. 05-22 19:36 — DuckDB timezone fix (you)
2. 05-20 14:30 — DB connection pool config (colleague)
3. 05-18 09:15 — Initial creation (you)
```

## Session Analyzer's Compact Mode

The `entries` action supports a `compact` parameter for streamlined output, ideal for quickly browsing large sessions:

```
# Standard mode
session_analyze(action="entries")
→ Complete records (with timestamps, type, full content)

# Compact mode
session_analyze(action="entries", compact=true)
→ Removes type column, time shows only HH:MM, previews 60 chars
→ Best for large sessions with 100+ entries
```

## Session Analyzer Analysis Dimensions

| Mode | Purpose | Example Command |
|------|---------|-----------------|
| `summary` | Session overview | "What did this session do?" |
| `entries` | Per-event listing | "List all file modifications" |
| `timeline` | Chronological flow | "What order did the AI operate in?" |
| `chain` | Sub-agent tracking | "What did the sub-agent do?" |
| `audit` | Compliance check | "Were there any rule violations?" |
| `digest` | Conversation sequence | "What did I and the AI discuss?" |
| `takeover` | Handover report | "Help me pick up where I left off" |

### The Most Useful Mode: takeover

`takeover` generates a handover report with 5 dimensions:

```
📋 Session Takeover Report

1. User intent: Fix DuckDB timezone issue
2. Modified files: connection.ts, connection.test.ts
3. Recent steps: Modified test mocks, tests pass
4. Next steps: Consider documenting timezone behavior
5. Key decisions: Chose to handle timezone at the connection layer, not the SQL layer
```

When you want to "continue where you left off," this report helps you (or another AI) quickly restore context.

## Best Practices

### ✅ Efficient Use of Session Analyzer

- **`grep` mode**: Search keywords across all sessions (much faster than digging through git log)
- **`file` mode**: Find all sessions touching a specific file (a code review essential)
- **`takeover` mode**: When taking over someone else's work, generate a handover report first
- **`compact` mode**: Quickly browse large sessions with streamlined output
- **`audit` mode**: Periodically check for AI rule violations

### ❌ Common Pitfalls

- Don't use `session_search` as a replacement for memory — search is about looking back (what was done), memory is about knowledge (what was learned)
- Don't expect to find full source code — session records are summaries, not complete backups

## Advanced Scenarios

### Scenario: Auditing AI Compliance

You've set many rules for the AI (don't write settings.json directly, don't overwrite large files), but you're not sure if it actually follows them. Use `audit` mode to check:

```
You: Audit the last session for rule violations

AI:
  🛠 session_analyze(action="audit", sessionId="...")
  
  ⚠️ Found 2 issues:
  1. [Violation] Direct writeFileSync(settings.json) — should use patchSettingsSectionWithBackup
  2. [Warning] Large file overwrite (312 lines) — should split or use edit
```

The audit mode checks for: prohibited operations, whether file modification rules were followed, and any unsafe actions.

### Scenario: Understanding the AI's Exploration Process

The AI used `/tree` to create exploration branches — tried Plan A (failed), then Plan B (succeeded). You want to know why Plan A failed:

```
You: The AI tried two approaches last time. Show me the results for each branch.

AI:
  🛠 session_analyze(action="branches", sessionId="...")
  
  🌿 Branch Analysis
  
  [Main branch] Discussed refactoring approach
  [B1] Plan A — Modified function signature + compatibility layer
      Result: Tests failed, compatibility layer introduced circular dependency
  [B2] Plan B — New interface + incremental migration
      Result: All tests passed ✅, merged back to main
```

This is more useful than digging through git log — git only records the final result, but branches shows the AI's trial-and-error process.

### Scenario: Tracking Sub-Agent Activities

Multiple sub-agents were spawned via `subagent` in a session. You want to know what each sub-agent produced:

```
You: What did the sub-agents do in the last session?

AI:
  🛠 session_analyze(action="chain", sessionId="...")
  
  🔗 Sub-Agent Chain
  
  Main Agent
    ├──→ pv-explorer
    │     Task: Analyze architecture of src/auth/ directory
    │     Result: 5 modules, 2 design patterns, dependency directions correct
    │
    └──→ pv-reviewer
           Task: Review JWT → session migration plan
           Result: Found 1 data model violation, 2 test gaps
```

The chain mode traces the call relationships between the main agent and sub-agents, clearly showing what task each sub-agent received and what result it returned.

## Next Steps

With the ability to review, both you and the AI can look back at past work. But there's still one problem: the longer a session goes on, the more the AI tends to "get dumber" — repeating itself, forgetting previous agreements.

In the next chapter, we'll look at how to keep the AI smart in long-running sessions.


Original: /home/lain/.pi/agent/distill/processor/read-b63ebc90-1779883939894.txt
