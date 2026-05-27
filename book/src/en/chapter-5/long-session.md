# A Survival Guide for Long Sessions

## You've Probably Been Here

You start a long session with pi, and the AI helps you through a lot of work. By the 50th turn, you notice:

- The AI starts asking questions you've already answered before
- It re-proposes a solution that was already rejected
- Its code quality noticeably declines — missing error handling, missing type definitions
- Sometimes it even starts "hallucinating" — inventing functions and files that don't exist

The worst case: The AI throws an error — "context window exceeded", and the entire session crashes.

> 💡 **This is the "context bloat" problem**: The AI's "working memory" has a fixed capacity, and when it's overloaded, things spill over.

## Root Cause

The AI's context window is a fixed-size "workbench":

```
Context Window (e.g., 128K tokens)
┌──────────────────────────────────────┐
│ System Prompt              ≈ 5K      │
│ Tool Definitions           ≈ 8K      │
│ Memory Injection           ≈ 2K      │
│ ─────────────────────────────        │
│ Conversation History       ≈ 80K     │ ← Main source of bloat
│ (previous 50 turns)                  │
│ Tool Results               ≈ 30K     │ ← Tool returns can be large
│ ─────────────────────────────        │
│ Remaining Space            ≈ 3K      │ ← Almost full!
└──────────────────────────────────────┘
```

The problem:

1. **Conversation history only grows**: Each turn adds content to the context and never removes anything
2. **Tool results can be massive**: `read` on a 1000-line file can take up 5K tokens
3. **Duplicate information accumulates**: The AI reads the same file multiple times, each time consuming space

## Two Tools: Smart Compact and Context Manager

You might ask: do I need to install both packages? The answer is: **yes, both are recommended** — they solve different problems:

| Dimension | pi-smart-compact | pi-context-manager |
|-----------|-----------------|-------------------|
| **What it does** | Compresses conversation history | Diagnoses token consumption + compresses tool results |
| **Active/Passive** | Fully automatic | Diagnosis needs you to ask AI, distill is automatic |
| **What it solves** | "Conversation history is too long" | "Too many tool results" + "Why is it so slow" |
| **Can they replace each other?** | ❌ No | ❌ No |

> 💡 **One-sentence summary**: context-manager helps you **find the problem** (where are the tokens going), smart-compact helps you **automatically fix it** (compress history). Best used together.

### pi-smart-compact — Smart Compression

Smart Compact automatically "compresses" conversation history when the context is nearly full:

```
Before compression (80K tokens of conversation history):
┌─────────────────────────────────┐
│ User: Help me look at auth.ts   │
│ AI: I read auth.ts... (500 words)│
│ User: Add a null check          │
│ AI: OK, I modified... (300 words)│
│ User: Run the tests             │
│ AI: Test results... (200 words) │
│ ... 50 turns repeated ...        │
└─────────────────────────────────┘

After compression (15K tokens summary):
┌─────────────────────────────────┐
│ Summary:                        │
│ - Added null check in auth.ts   │
│ - Modified corresponding test   │
│ - All tests passed               │
│ - Used JWT authentication scheme│
│ ... Key information preserved ...│
└─────────────────────────────────┘
```

Two-phase compression strategy:

| Phase | Method | Description |
|-------|--------|-------------|
| Phase 1 | Extract key information (decisions, file changes, conclusions) | Traverse conversation, generate structured intent summary |
| Phase 2 | Discard low-value information (repeated file reads, intermediate debug output) | Let LLM judge tool results batch by batch |

### pi-context-manager — Diagnostic Tool

pi-context-manager provides the `payload_analyze` tool to help you see exactly where your tokens are going:

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

## Real-World Case: Diagnosing a Context Crash

### Real Scenario Review

Once, a session crashed at only **34.8%** context usage. It seemed unlikely — only a third used?

Using pi-context-manager's `budget` mode for analysis, the root cause was found:

```
Root cause:
34.8% of tool results were error output
→ Lots of repeated "Command not found" error messages
→ Each error consumed tokens without providing valuable information
→ Accumulated and prematurely exhausted the context
```

**Solution**: Added an `after_bash` hook in shepherd rules to automatically truncate error output from failed commands, preventing wasteful token consumption.

### Using growth Mode for Trends

```
📈 Context Growth Trend

Request #1:  15K  ████
Request #5:  28K  ███████
Request #10: 45K  ████████████
Request #15: 72K  ████████████████████
Request #20: 98K  ██████████████████████████  ← Approaching limit
Request #23: 💥 Crash!
```

**Key finding**: The fastest growth was between turns 10-15, when extensive file searching was happening.

**Optimization**: Using `code_graph_semantic_code_search` (compact mode, returns only signatures and locations) instead of `grep` (returns full matching lines) reduced token consumption by 70%.

## Configuring Smart Compact

Install via `settings.json`:

```json
{
  "packages": ["pi-smart-compact"]
}
```

It takes effect automatically after installation — no additional configuration needed.

### Optional Advanced Configuration

In `.pi/settings.json`:

```json
{
  "smart-compact": {
    "auto": "auto"
  }
}
```

- `auto`: Automatic trigger (default, recommended)
- `manual`: Only responds to the `/smart-compact` command

Manual trigger: Type `/smart-compact` in the conversation.
View configuration: Type `/smart-compact-config`.

## Payload Analyzer Common Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `budget` | Token budget analysis (system/tools/history composition) | "Where are my tokens going?" |
| `growth` | Context growth trend (token curve over requests) | "Why is it getting slower?" |
| `expensive` | Most expensive tool calls (Top N sorted) | "Which tool consumes the most tokens?" |
| `overview` | Per-message detailed analysis (includes distill events) | "Pinpoint a specific point in time" |
| `messages` | Locate messages by index/range/keyword | "What did message 10 say?" |
| `chain` | Track the same tool call across payloads | "What happened to this call later?" |
| `chain-tcid` | Track the same toolCallId across payloads | "Verify distill behavior" |
| `diff` | Compare differences between two payloads | "What's different between these two requests?" |
| `stats` | Aggregate statistics on distill/processor hit rate | "How efficient is the compression?" |
| `single` | Analyze a single payload file | "Deep dive into one recording file" |
| `list` | List all recording files | "What's available for analysis?" |

> 💡 **Diagnosis workflow**: Start with `list` to see available recordings → `budget` for overall distribution → `expensive` to find the heavy hitters → `messages` for precise targeting.

## Context Manager's Aging and Processor

Beyond Distill, pi-context-manager offers two additional helper mechanisms:

### Aging

Automatically evicts old tool outputs that haven't been referenced for a long time. Use `/aging-config` to set the eviction rounds.

Special exemption: Skill file (SKILL.md) content is never evicted by aging, ensuring the AI always sees the currently loaded skills.

### Tool Result Processor

Formats and trims specific types of tool output (e.g., code-graph AST search results, MCP JSON output). Use `/processor-config` to set thresholds.

### /context TUI Panel

Type `/context` to open a visual panel for browsing context content by category and manually marking content for deletion.

## Best Practices

### ✅ Habits for Healthy Long Sessions

1. **Use compact mode for search**: `code_graph_semantic_code_search(compact: true)` saves 70% tokens over `grep`
2. **Compress early**: Don't wait until it crashes — trigger compression when the context approaches its limit
3. **Avoid repeated reads**: Use memory to remember file content instead of repeatedly `read`ing the same file
4. **Read large files in chunks**: Use `offset/limit` to read only the parts you need, not the whole file
5. **Configure aging wisely**: Set 8-12 rounds for eviction to automatically clean up stale content
6. **Run payload_analyze checkups regularly**: Run `budget` once during a long session to catch problems early

### ✅ Diagnostic Priority

```
When context has issues:
  1. payload_analyze budget → Check total distribution
  2. payload_analyze expensive → Find the most expensive calls
  3. payload_analyze growth → Look at growth trends
  4. Targeted optimization (switch tools, add filters, adjust strategy)
```

### ❌ Common Misconceptions

- "I still have 50% context left, nothing to worry about" → Wrong, tool results can suddenly balloon
- "Compression will lose important information" → Smart Compact prioritizes preserving decisions and conclusions
- "Just restart the session" → Treats the symptom, not the root cause — you'll run into the same problem again

## Next Steps

Now the AI has memory, planning, rules, review, and compression — it's already quite a capable assistant. But it's still "passive" — it only acts when you ask.

Can the AI work proactively? For example, automatically check code quality every day, or automatically run a research analysis?

In the next chapter, we'll look at how to make the AI **automate work**.


Original: /home/lain/.pi/agent/distill/processor/read-ed6e48fc-1779884015234.txt
