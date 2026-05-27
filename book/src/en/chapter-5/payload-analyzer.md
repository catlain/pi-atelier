# 5.3 Diagnosing Token Consumption with pi-context-manager

> The functionality of pi-payload-analyzer has been merged into pi-context-manager. This section introduces how to use the unified `payload_analyze` tool to diagnose context issues.

## Where Did All the Tokens Go?

In long sessions, AI becomes less intelligent often because the context is filled with "junk." But what exactly is consuming tokens? Guessing won't help.

pi-context-manager provides the `payload_analyze` tool, which uses **data** to tell you where your tokens are going.

## Recording Must Be Enabled First

`payload_analyze` requires recorded payload data before it can analyze. In the conversation, type:

```
/record on
```

Recordings are saved to `~/.pi/agent/distill/recordings/`. There is a slight performance overhead while recording; remember to turn it off with `/record off` when done.

## Analysis Mode Quick Reference

### Global Overview

| Mode | Usage | Output |
|------|-------|--------|
| `list` | List all recording files | File list + sizes |
| `budget` | Token budget analysis | Breakdown of system/tools/history |
| `growth` | Growth trend | Token usage curve over requests |
| `stats` | Aggregate statistics | Distill/processor hit rate, compression efficiency |

### Deep Diagnosis

| Mode | Usage | Output |
|------|-------|--------|
| `expensive` | Most expensive tool calls | Top N sorted by token count |
| `overview` | Per-message detailed analysis | Token breakdown per message + distill events |
| `messages` | Precise message targeting | Filter by index/range/keyword |

### Tracking & Comparison

| Mode | Usage | Output |
|------|-------|--------|
| `chain` | Track tool call fate | Cross-payload changes for the same argsSig |
| `chain-tcid` | Track toolCallId | Verify distill behavior |
| `diff` | Compare two payloads | Identify differences between two requests |
| `single` | Analyze a single file | Full analysis of one recording file |

### Messages Mode — Precise Targeting

`messages` is the most flexible diagnostic tool, supporting multiple filtering methods:

```
# View message #5 (0-based)
payload_analyze(action="messages", msgIndex=5)

# View messages 5-10
payload_analyze(action="messages", msgRange="5-10")

# View the last 5 messages
payload_analyze(action="messages", msgRange="last:5")

# Filter by keyword
payload_analyze(action="messages", grep="error|fail")

# Filter by tool name
payload_analyze(action="messages", toolName="read")
```

## Practical Cases

### Case 1: Find the Root Cause of Context Bloat

```
Step 1: Use budget mode to see totals
You: "Use payload_analyze to analyze token budget"
Result: Tool Results account for 49.5%

Step 2: Use expensive mode to find the biggest consumers
You: "Find the Top 10 most token-consuming tool calls"
Result: read(schema.ts) consumes 8.2K tokens

Step 3: Optimize
→ Use offset/limit to read large files in chunks
→ Or enable distill for automatic compression
```

### Case 2: Diagnose Compression Efficiency

```
Step 1: Use stats mode to check hit rate
You: "Check distill and processor compression efficiency"
Result: distill hit rate 75%, processor hit rate 60%

Step 2: Use chain mode to track
You: "Track distill behavior for read(schema.ts)"
Result: Distilled on the 3rd request, compressed from 8.2K to 1.5K
```

### Case 3: Compare Differences Between Two Requests

```
You: "Compare these two payloads for differences"
AI calls payload_analyze(action="diff", payloadPath="...", payloadPath2="...")
Result: The second request has 3 additional tool calls, but 2 were compressed by distill
```

> 📖 For complete long session diagnosis cases, see [5.1 Long Session Survival Guide](./long-session.md)
