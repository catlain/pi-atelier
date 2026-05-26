# 5.3 Diagnosing Token Consumption with pi-context-manager

> The functionality of pi-payload-analyzer has been merged into pi-context-manager. This section introduces how to use the unified `payload_analyze` tool to diagnose context issues.

## Where Do All the Tokens Go?

In long sessions, the AI gets dumber because the context gets filled with "garbage." But what exactly is consuming the tokens? Guessing won't help.

pi-context-manager provides the `payload_analyze` tool, which uses **data** to tell you where the tokens are going.

## Four Analysis Modes

### 1. budget — Token Budget Analysis

See how many tokens are used by the system prompt, tool definitions, and conversation history:

```
Payload composition when sent to the AI
┌──────────────────────────────┐
│ system prompt (12%)          │ ← You can control: trim AGENTS.md
│ tools definition (18%)       │ ← You can control: install fewer extensions
│ conversation history (65%)   │ ← This is the main cause of bloat!
│ current message (5%)         │
└──────────────────────────────┘
```

### 2. growth — Growth Trend

Plots the token usage curve across conversation turns, helping you see "which turn started the explosion."

### 3. expensive — Most Expensive Calls

Lists tool calls sorted by token count, from most to least resource-intensive. These are typically large file reads, excessive search results, etc.

### 4. overview — Per-Message Analysis

Detailed token breakdown for each message, used for precise diagnosis.

## Practical Case Study

> 📖 See the full case study in [5.4 Hands-on Diagnosis](./long-session.md)
