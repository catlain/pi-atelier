# 3.3 How pi-context-manager Works: Information Quality Control & Token Diagnostics

> pi-context-manager is the merger of the original pi-context and pi-payload-analyzer, providing unified context quality management.

## Two Core Capabilities

### Distill: Compressing Voluminous Tool Output

When a tool returns a large amount of content (e.g., reading a 1000-line file), pi-context-manager automatically compresses it, retaining only the essential information:

```
Raw Tool Output (50KB)
     │
     ▼
┌────────────────────────┐
│   Distill Processor    │
│   Extract Key Lines    │
│   + Summary            │
└────────────────────────┘
     │
     ▼
Compressed Output (~5KB)
     │
     ▼
AI Sees Refined Information
```

**Distill is enabled by default.** Once pi-context-manager is installed, large tool outputs are automatically compressed — no manual configuration required.

If you need a custom compression strategy, you can configure it in `.pi/config.json` at your project root:

```json
{
  "context-manager": {
    "distill": {
      "max_output_tokens": 5000,
      "preserve_file_paths": true,
      "compress_json": true,
      "keep_full_lines_for_patterns": [
        "import ",
        "export ",
        "function ",
        "class ",
        "interface ",
        "type "
      ]
    }
  }
}
```

| Config | Description | Default |
|--------|-------------|---------|
| `max_output_tokens` | Max tokens after compression | 5000 |
| `preserve_file_paths` | Preserve file path info | true |
| `compress_json` | Compress JSON output | true |
| `keep_full_lines_for_patterns` | Lines matching these prefixes are kept in full | `["import ", "export ", ...]` |

> 💡 **Frontend project tip**: If you're using React/Vue, consider adding `"export default "` and `"const Component"` to `keep_full_lines_for_patterns` to ensure component definitions are never compressed away.

### Payload Analysis: Diagnosing Context Issues with Data

Is the AI getting dumber after a long session? Use `payload_analyze` to find out why.

> ⚠️ **Important**: `payload_analyze` is an **AI tool**, not a terminal command. You ask the AI in your pi chat to execute it. For example, just tell the AI:
>
> ```
> Run payload_analyze to check current token usage
> ```
>
> Or be more specific:
>
> ```
> Run payload_analyze action="budget"
> ```

| Analysis Mode | How to Ask the AI | What to Look At |
|---------------|-------------------|-----------------|
| `budget` | "Analyze token budget distribution" | Token share of system/tools/history |
| `growth` | "Check token growth trend" | How tokens balloon as the session progresses |
| `expensive` | "Find the most token-expensive tool calls" | Top N most expensive tool calls |
| `overview` | "Detailed payload analysis" | Per-message token breakdown |

**Hands-on: Diagnose Your First Long Session**

Suppose your session has been running for 40 turns and the AI is getting dumber:

```
Step 1: Diagnose token distribution
You: "Run payload_analyze to analyze the token budget"
AI calls payload_analyze(action="budget")

Step 2: Review results
If Tool Results > 40% → tools are returning too much content
If Error Output > 30% → the AI is making repeated mistakes
If Conversation > 50% → the conversation itself is too long

Step 3: Pinpoint the issue
"Find the most token-expensive tool calls"
AI calls payload_analyze(action="expensive")

Step 4: Fix the problem
→ Install pi-smart-compact (see Chapter 5) to auto-compress history
→ Tweak distill config to compress specific tool outputs
→ Split sessions (open a new session for independent tasks)
```

> 💡 **Chicken-and-egg problem**: If the AI is already too dumb to execute payload_analyze correctly, open a new session to analyze the old session's recording files. payload_analyze supports analyzing historical recordings (`action="list"` lists all recordings).

## Best Practices

| Problem You Encounter | Step 1 | Step 2 | Solution |
|-----------------------|--------|--------|----------|
| AI gets dumber after 30 turns | `payload_analyze(action="growth")` | Check where tokens exploded | Lower distill threshold / Install smart compression |
| AI ignores certain file content | Check distill config | Distill may be over-compressing | Whitelist key files in `keep_full_lines_for_patterns` |
| Every tool call is very slow | `payload_analyze(action="expensive")` | Find Top N most expensive calls | Limit large file reads or split files |

## Next Up

In the next chapter, we'll explore how to teach the AI to **review its own work** — automatically logging session events for easy backtracking at any time.
