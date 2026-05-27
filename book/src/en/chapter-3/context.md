# 3.3 pi-context-manager: Information Quality Control & Token Diagnostics

> pi-context-manager is the merger of the original pi-context and pi-payload-analyzer, providing unified management of context quality and token diagnostics.

## Three Core Capabilities

### 1. Distill: Compressing the Flood of Tool Output

When a tool returns a large amount of content (e.g., reading a 1000-line file), pi-context-manager automatically compresses it, keeping only essential information:

```
Raw tool output (50KB)
     │
     ▼
┌────────────────────────┐
│   Distill Processor     │
│   Extract key lines +   │
│   summary               │
└────────────────────────┘
     │
     ▼
Compressed output (~5KB)
     │
     ▼
AI sees refined information
```

**Distill is enabled by default.** Two key parameters:

| Config | Command | Description |
|--------|---------|-------------|
| `distillThreshold` | `/distill-config` | Tool outputs exceeding this token count will be compressed |
| `firstSeenCap` | `/distill-config --cap` | Maximum token cap for first-encountered tool output (0 = no limit) |

> 💡 **Purpose of firstSeenCap**: Some tools return massive results on first use (e.g., `ls` listing a large directory), but you don't need all of it. `firstSeenCap` limits the initial output size; subsequent requests may further compress the result through distill.

### 2. Tool Result Processor: Smart Formatting & Trimming

The Tool Result Processor performs structured trimming on specific tool outputs, more precise than distill:

- **Code Graph output trimming**: Auto-compresses AST search results, preserving only key signatures and locations
- **MCP JSON output trimming**: Compresses verbose JSON returned by MCP tools
- **Error output trimming**: Truncates overly long error stack traces
- **Web search output trimming**: Keeps only key information from search results

Use the `/processor-config` command to view or adjust processing thresholds.

### 3. Aging: Phasing Out Stale Content

In long sessions, early tool outputs may no longer be relevant. The Aging mechanism automatically phases out "outdated" content:

```
Round 1:  Tool Output A (fresh 🟢)
Round 5:  Tool Output A (a bit old 🟡)
Round 10: Tool Output A (too old 🔴 → auto-deleted)
```

**Aging Smart Exemptions**: Certain content types are protected from aging:
- Skill files (SKILL.md) content
- User-flagged content
- Content most recently referenced by the AI

Use `/aging-config` to set the eviction round count, or `/aging-config off` to disable.

### 4. Payload Analysis: Diagnosing Context Issues with Data

Is the AI getting dumber as the session grows long? Use `payload_analyze` to find out.

> ⚠️ **Important**: `payload_analyze` is an **AI tool**, not a terminal command. You ask the AI to run it in your pi chat. For example:
>
> ```
> Help me check the current token usage with payload_analyze
> ```
>
> Or more precisely:
> ```
> Run payload_analyze action="budget"
> ```

| Analysis Mode | How to Ask the AI | What It Shows |
|---------------|-------------------|---------------|
| `budget` | "Analyze token budget distribution" | Token ratio of system/tools/history sections |
| `growth` | "Show token growth trend" | How tokens expand over the course of a session |
| `expensive` | "Find the most token-hungry tool calls" | Top N most expensive tool calls |
| `overview` | "Detailed payload analysis" | Per-message token breakdown |
| `messages` | "View message #5" | Pinpoint messages by index/range/keywords |
| `chain` | "Trace this tool call" | Track a single tool call across payloads |
| `diff` | "Compare two payloads" | Find differences between two requests |
| `stats` | "Show distill/processor hit rate" | Aggregate compression efficiency statistics |

> 💡 **Start with budget, then dive deeper**: When facing context issues, first use `budget` for an overview, then `expensive` to pinpoint the heavy hitters, and finally `messages` to examine a specific message.

## /context TUI Panel

pi-context-manager also provides a TUI (Terminal User Interface) panel for visually browsing context content:

```
/context command
     │
     ▼
┌─────────────────────────────────────┐
│  📊 Context Panel                    │
│                                      │
│  [Categories] [Tool Details]         │
│  [Mark for Deletion]                 │
│                                      │
│  ├─ System Prompt    4.2K tokens     │
│  ├─ Tool Definitions 8.1K tokens     │
│  ├─ Memory           2.3K tokens     │
│  ├─ History          52K tokens      │
│  │   ├─ Rounds 1-10  (marked delete) │
│  │   ├─ Rounds 11-20                 │
│  │   └─ Rounds 21-30                 │
│  └─ Tool Results     64K tokens      │
│      ├─ read(schema.ts)  8.2K 🔴     │
│      └─ grep("TODO")    4.1K 🟡     │
└─────────────────────────────────────┘
```

In the panel you can:
- **Browse by category**: View context content by type
- **Tool details**: See full content returned by each tool
- **Mark for deletion**: Manually flag unwanted content for exclusion in the next request

## Complete Command Reference

| Command | Purpose | Behavior without args |
|---------|---------|----------------------|
| `/record [on\|off]` | Toggle payload recording | Toggle on/off |
| `/context` | Open TUI visualization panel | — |
| `/distill-config [N]` | View/set distill threshold | Show current config + usage |
| `/distill-config --cap [N]` | View/set firstSeenCap | Show current config + usage |
| `/processor-config [N\|off]` | View/set processor threshold | Show current config + usage |
| `/aging-config [N\|off]` | View/set aging round count | Show current config + usage |
| `/context-clean [sessionId]` | Clean persistent data | Clean all data |

## Best Practices

| Issue You're Facing | First Step | Next Step | Solution |
|--------------------|-----------|-----------|----------|
| AI gets dumber after 30 rounds | `payload_analyze(action="growth")` | Check which phase tokens spike | Lower distill threshold / install smart compact |
| AI ignores certain file content | Check distill config | May be over-compressed by distill | Adjust `distillThreshold` |
| Every tool call is painfully slow | `payload_analyze(action="expensive")` | Find the most expensive calls | Limit large file reads or split files |
| Old tool outputs consume space | Run `/aging-config` | Set appropriate eviction rounds | Aging auto-evicition + manual `/context` panel cleanup |
| First tool output is too large | Set `/distill-config --cap` | Limit initial full-text output | `firstSeenCap` limits first output size |

## Next Steps

In the next chapter, we'll explore how to teach the AI to **review** — automatically record session events and revisit history at any time.


Original: /home/lain/.pi/agent/distill/processor/read-b63ebc90-1779883939893.txt
