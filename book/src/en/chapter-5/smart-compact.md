# 5.2 pi-smart-compact Principles: Two-Phase Enhanced Compaction

> Smart Compact is an enhanced version of pi's built-in Compaction mechanism — instead of simply truncating history, it "intelligently" decides what to keep and what to discard.

## Why Enhanced Compaction?

pi's built-in Compaction automatically compresses old conversations when the context approaches its limit, but it isn't "smart" enough:

```
Built-in Compaction:
  100 rounds of conversation before compression → a generic summary after compression
  Problem: the summary is too coarse, critical details are lost, and tool call results are indiscriminately truncated.
```

Smart Compact's improvement — **intercepts pi's compaction event** and performs two-phase enhanced compaction:

| Phase | What It Does | How It Works |
|-------|-------------|--------------|
| Phase 1: Intent Summary | Extract user intent, key decisions, current state | Traverse conversation, extract non-tool text from AI replies, generate structured intent summary |
| Phase 2: Tool Filtering | Determine which tool call results can be safely discarded | Pair all tool calls (call + result), let LLM decide keep/discard in batches |

```
pi triggers compact event
  → Smart Compact takes over (if auto mode is on)
    → Phase 1: Extract intent summary (keep decisions, agreements, conclusions)
    → Phase 2: Evaluate tool results for keep/discard in batches
  → Output a refined conversation history, replacing pi's default rough summary.
```

The two phases are executed **sequentially in one go** — Smart Compact takes over the compaction event, first performs the intent summary, then filters tools, and finally outputs the refined result. They are not triggered in stages based on context usage rate.

## Configuration

### Installation

```json
{
  "packages": ["pi-smart-compact"]
}
```

### Commands

| Command | Usage |
|---------|-------|
| `/smart-compact` | Manually trigger two-phase compaction |
| `/smart-compact-config [auto\|manual]` | View or switch between auto/manual mode |

### Auto/Manual Mode

- **`auto`** (default): Automatically takes over when pi triggers a compact event, performing enhanced compaction
- **`manual`**: Only triggers when the user executes `/smart-compact`

### Advanced Configuration

Configure in `~/.pi/agent/settings.json`:

```json
{
  "smart-compact": {
    "enabled": true,
    "intentModel": "",
    "filterModel": "",
    "thinkingTruncateChars": 500,
    "toolCallTruncateChars": 2000,
    "toolResultTruncateChars": 5000,
    "filterBatchSize": 10
  }
}
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `intentModel` | Empty (uses session default model) | Model used for Phase 1 intent summary |
| `filterModel` | Empty (uses session default model) | Model used for Phase 2 tool filtering |
| `thinkingTruncateChars` | 500 | Character limit for truncating thinking blocks |
| `toolCallTruncateChars` | 2000 | Character limit for truncating toolCall arguments |
| `toolResultTruncateChars` | 5000 | Character limit for truncating toolResult content |
| `filterBatchSize` | 10 | Number of tools evaluated per batch in Phase 2 |

## What Does Compaction Preserve?

Smart Compact's Phase 2 evaluates tool results based on the following priority:

| Priority | Content Type | Why Preserve |
|----------|-------------|--------------|
| 🔴 Highest | User's explicit requirements and constraints | These are the task objectives |
| 🟠 High | Key decisions and reasoning for choices | Prevents AI from re-debating already rejected solutions |
| 🟡 Medium | File modification records (edit/write) | Lets AI know which files have been modified |
| 🟢 Low | File reads and search results | Can be re-executed |
| ⚪ Lowest | Failed attempts and debugging process | Lessons have already been learned |

## Best Practices

- **Enable auto mode for long sessions**: Smart Compact automatically takes over when pi is about to compact, preserving more critical information than the default compaction
- **Manual trigger is useful before critical operations**: Run `/smart-compact` manually to clean up context before starting an important refactoring
- **Use with context-manager**: Smart Compact compresses conversation history, while Context Manager's distill compresses tool outputs — they complement each other
- **Use cheaper models for compaction**: If you don't want to waste the main model's tokens, specify `filterModel` in the configuration to use a cheaper model

> 📖 Back to [5.1 Long Session Survival Guide](./long-session.md) for complete diagnosis and optimization cases.
