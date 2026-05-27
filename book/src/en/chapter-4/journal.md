# 4.2 pi-journal: Automated Log Reports

## Why Do You Need Logs?

You've been working with pi all day and accomplished a lot:

- Fixed two bugs in the morning, along with refactoring a module
- Set up the CI pipeline in the afternoon, wrote a bunch of tests
- Researched a new approach in the evening, updated memory files

At night, you want to review: "What exactly did I do today?" You check `git log` — it's all fragmented commits. You check memory files — only key conclusions are recorded. You check session records — there are a dozen sessions and you don't know where to start.

> 💡 **You need an "auto daily report"** — something that aggregates your activities scattered across git, memory, and sessions into a readable report.

## What pi-journal Does

pi-journal collects data from three sources and automatically generates Markdown daily/weekly reports:

| Data Source | Collected Content |
|-------------|-------------------|
| Git Activity | Scans all repos under `~/.pi/agent/git/`, counts commits, file changes, lines added/deleted |
| Memory Changes | Scans global and project memory directories, identifies file changes within the time range |
| Session Activity | Scans pi session records, counts sessions, tool calls, edit operations, active duration |

## Usage

### Command: `/journal`

```bash
# Today's daily report (default)
/journal

# Specify a time range
/journal yesterday
/journal this_week
/journal 3d          # Last 3 days
/journal 2025-05-27  # Specific date
```

### Tool: `journal`

AI can also proactively call the `journal` tool to generate a report. When you say "write a log", "what did I do today", or "write a weekly report", the AI will automatically trigger it.

## Generated Report Format

```markdown
# 📓 Daily Report — 2025-05-27

## Git Activity
- **pi-shepherd** (2 commits, +45/-12)
  - Added tool_result rule support
  - Fixed priority sorting bug
- **pi-context-manager** (1 commit, +30/-5)
  - Added aging auto-eviction feature

## Memory Changes
- Added: debug_anti_pattern.md
- Updated: coding_standards.md

## Session Activity
- 019e6494 (45m) — Shepherd rule engine refactoring
  - Tool calls: 23, Edits: 8
- 019e6203 (30m) — Context aging feature implementation
  - Tool calls: 15, Edits: 5

## Summary
- Total commits: 3
- Total sessions: 12
- Total edits: 43
```

## Best Practices

### ✅ Recommended Usage

- **At the end of each day**: `/journal` to generate a daily report and review what you did
- **Friday wrap-up**: `/journal this_week` to generate a weekly report
- **Let AI do it**: Just say "write today's log" and the AI will invoke the tool to generate it

### ⚠️ Notes

- The "AI Summary" section requires the AI to supplement after generation
- Git activity only scans repos under `~/.pi/agent/git/`, not other git repos elsewhere on the system
- Session activity depends on pi's session record storage

## How It Works

```
User inputs a time range
      ↓
  parseTimeRange()  →  Parses into since/until timestamps
      ↓
  ┌─────────────┬──────────────┬──────────────────┐
  │ Git Activity │ Memory Changes│ Session Activity │
  │ Auto-discover│ Scan memory/ │ Get session list │
  │ repos        │ file timestamps│from session-    │
  │ git log stats│               │ analyzer         │
  └──────┬──────┴──────┬───────┴────────┬─────────┘
         ↓             ↓                ↓
      renderReport()  →  Aggregate and render as Markdown
         ↓
      Output report
```

## Next Steps

pi-journal solves the "look back at the past" need. But sometimes you need more than just a review — you need to **find a specific session and see what the AI was thinking at the time**. In the next section, we'll look at the detailed usage of pi-session-analyzer.


Original: /home/lain/.pi/agent/distill/processor/read-ed6e48fc-1779884015233.txt
