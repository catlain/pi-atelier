# Long Session Survival Guide

## You've Probably Experienced This

You start a long session, and the AI helps you get a lot done. By the 50th turn, you notice:

- The AI starts asking questions you've already answered
- It re-proposes a plan that was already rejected
- Its code quality noticeably drops — missing error handling, type definitions
- Sometimes it even starts hallucinating — inventing functions and files that don't exist

The worst case: the AI hits a "context window exceeded" error, and the entire session crashes.

> 💡 **This is the "context bloat" problem**: the AI's "working memory" has a capacity limit — too much stuff and it overflows.

## Root Cause

The AI's context window is a fixed-size "workbench":

```
Context window (e.g., 128K tokens)
┌──────────────────────────────────────┐
│ System Prompt               ≈ 5K     │
│ Tool Definitions            ≈ 8K     │
│ Memory Injection            ≈ 2K     │
│ ─────────────────────────────        │
│ Conversation History (50 turns) ≈ 80K│ ← Main source of bloat
│ Tool Results                ≈ 30K    │ ← Tool returns can be large
│ ─────────────────────────────        │
│ Remaining Space             ≈ 3K     │ ← Almost full!
└──────────────────────────────────────┘
```

The problem:

1. **Conversation history only grows**: each turn adds content, never removes
2. **Tool results can be huge**: `read` a 1000-line file and that's ~5K tokens
3. **Duplicate information accumulates**: the AI reads the same file multiple times, each taking up space

## Two Tools: Smart Compact and Context Manager

You might ask: do I need both? The answer is: **it's recommended to install both** — they solve different problems:

| Aspect | pi-smart-compact | pi-context-manager |
|--------|------------------|--------------------|
| **What it does** | Compresses conversation history | Diagnoses token consumption + distills tool results |
| **Active/Passive** | Fully automatic | Diagnosis on demand; distill runs automatically |
| **What it solves** | "Conversation history is too long" | "Too many tool results" + "Why is it so slow" |
| **Can they replace each other?** | ❌ No | ❌ No |

> 💡 **TL;DR**: context-manager helps you **find the problem** (where tokens are going), smart-compact helps you **automatically fix it** (compress history). They work best together.

### pi-smart-compact — Smart Compression

Smart Compact automatically "compresses" conversation history when the context is nearly full:

```
Before compression (80K tokens of conversation history):
┌─────────────────────────────────┐
│ User: take a look at auth.ts    │
│ AI: I read auth.ts...(500 chars)│
│ User: add a null check          │
│ AI: OK, I modified...(300 chars)│
│ User: run the tests             │
│ AI: test results...(200 chars)  │
│ ... repeated for 50 turns ...   │
└─────────────────────────────────┘

After compression (15K token summary):
┌─────────────────────────────────┐
│ Summary:                        │
│ - Added null check in auth.ts   │
│ - Modified corresponding test   │
│ - All tests pass                │
│ - Using JWT authentication      │
│ ... key information retained ... │
└─────────────────────────────────┘
```

Two-stage compression strategy:

| Stage | Method | When triggered |
|-------|--------|---------------|
| Stage 1 | Extract key information (decisions, file changes, conclusions) | Context usage > 60% |
| Stage 2 | Discard low-value information (repeated file reads, intermediate debug output) | Context usage > 80% |

### pi-context-manager — Diagnostic Tool

pi-context-manager provides the `payload_analyze` tool to help you see exactly where tokens are being spent:

```
📊 Token Budget Analysis

System Prompt:    4,200 tokens ( 3.2%)
Tool Definitions: 8,100 tokens ( 6.2%)
Memory Injection: 2,300 tokens ( 1.8%)
Conversation:    52,400 tokens (40.0%)
Tool Results:    64,800 tokens (49.5%)  ← The big one!
──────────────────────────────────────
Total:          131,800 / 128,000      ← Over budget!

Top 3 most expensive tool calls:
1. read(src/database/schema.ts)  — 8,200 tokens
2. code_graph_module_overview    — 6,400 tokens
3. grep("TODO|FIXME")           — 4,100 tokens
```

## Real-World Case: Diagnosing Context Crashes

### Real Scenario

Once, a session crashed at only **34.8%** context usage. That didn't seem right — only a third full?

Using the `budget` mode of pi-context-manager, we found:

```
Root cause:
34.8% of tool results were error output
→ Lots of repeated "Command not found" errors
→ Each error consumed tokens without providing value
→ Accumulated and exhausted the context prematurely
```

**Solution**: Added an `after_bash` hook to the shepherd rules that automatically truncates error output from failed commands, preventing meaningless token consumption.

### Using Growth Mode to See Trends

```
📈 Context Growth Trend

Turn #1:   15K  ████
Turn #5:   28K  ███████
Turn #10:  45K  ████████████
Turn #15:  72K  ████████████████████
Turn #20:  98K  ██████████████████████████  ← Approaching limit
Turn #23:  💥 Crash!
```

**Key finding**: The fastest growth occurred between turns 10-15, due to heavy file searching.

**Optimization**: Replaced `grep` (returns full matching lines) with `code_graph_semantic_code_search` (returns only signatures and locations in compact mode), reducing token consumption by 70%.

## Configuring Smart Compact

Install via `settings.json`:

```json
{
  "packages": ["pi-smart-compact"]
}
```

It activates automatically after installation — no extra configuration needed.

### Optional Advanced Configuration

In `.pi/config.json`:

```json
{
  "smart-compact": {
    "phase1_threshold": 0.6,
    "phase2_threshold": 0.8,
    "preserve_patterns": [
      "decision.*:",
      "chose.*approach",
      "convention.*:"
    ]
  }
}
```

## Payload Analyzer Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `budget` | Token budget analysis | "Where are all the tokens going" |
| `growth` | Context growth trend | "Why is it getting slower" |
| `expensive` | Most expensive tool calls | "Which tool consumes the most tokens" |
| `overview` | Per-message detailed analysis | "Precise diagnosis at a certain point" |
| `stats` | Aggregate statistics | "What's the overall efficiency" |

## Best Practices

### ✅ Habits for Healthy Long Sessions

1. **Use compact mode for searches**: `code_graph_semantic_code_search(compact: true)` saves 70% tokens over `grep`
2. **Compress early**: don't wait until a crash — trigger compression at 60% usage
3. **Avoid repeated reads**: use memory to remember file content instead of `read`-ing the same file repeatedly
4. **Read large files in chunks**: use `offset/limit` to read only what's needed, not the whole file

### ✅ Diagnostic Priority

```
When context has issues:
  1. payload_analyze budget → see overall distribution
  2. payload_analyze expensive → find the most expensive calls
  3. payload_analyze growth → check growth trends
  4. Targeted optimization (swap tools, add filters, adjust strategy)
```

### ❌ Common Misconceptions

- "There's still 50% context space, no worries" → Wrong, tool results can suddenly spike
- "Compression will lose important information" → Smart Compact prioritizes decisions and conclusions
- "Just restart the session" → Symptom relief, not a cure — you'll hit the same problem again

## Next Steps

By now, the AI has memory, planning, rules, retrospectives, and compression — it's become quite a capable assistant. But it's still "passive" — it only acts when you ask.

Can we make the AI work proactively? Like automatically checking code quality every day, or running research analysis on its own?

In the next chapter, we'll explore how to make AI work **autonomously**.
