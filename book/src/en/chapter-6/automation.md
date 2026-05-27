# Automation & Workflows

## You Might Have Encountered This

Every Friday afternoon, you do the same thing:

1. Check all sessions from this week to see what files were changed
2. Run tests to make sure there are no regressions
3. Check for uncommitted code
4. Write a weekly summary — recap the week's progress

Each time you have to manually remind the AI to do these things. Sometimes you forget, and come back on Monday only to find that last Friday's changes were never committed.

> 💡 **An AI can do things, but it won't "actively" do things.** You need to tell it "what to do now."

## Two Tools: Scheduler and Workflow

### pi-scheduler — Scheduled Tasks

The Scheduler lets the AI do specific things at specific times:

```
Scheduled trigger
     │
     ▼
┌──────────────────┐
│  Inject preset    │
│  message          │
│  "It's Friday PM, │
│   run weekly check" │
└──────────────────┘
     │
     ▼
  AI executes automatically
```

Supported schedule types:

| Type | Description | Example |
|------|-------------|---------|
| One-shot | Triggers once after a specified time | "Remind me about the meeting in 30 min" |
| Recurring | Repeats at a fixed interval | "Check tests every 2 hours" |

### pi-workflow — Sub-agent Orchestration

Workflow lets the AI break complex tasks into multiple sub-agents that execute in parallel:

```
Main agent: "Research best practices for XXX"
     │
     ├──→ Sub-agent 1: Search online resources
     ├──→ Sub-agent 2: Search GitHub source code
     └──→ Sub-agent 3: Search historical sessions
          │
          ▼
     Main agent: Synthesize results from all three sub-agents and give recommendations
```

Sub-agents are independent execution environments:

- They have their own context window (no pollution of the main session)
- They have their own tool set (permissions can be restricted)
- They return results to the main agent when done

## Real-world Example: Automated Weekly Report

### Configuring Automatic Friday Checks

```json
{
  "action": "create",
  "interval_ms": 604800000,
  "recurring": true,
  "prompt": "It's Friday afternoon. Please perform the following checks:\n1. Use session_search to review all sessions from this week\n2. Use session_analyze summary to summarize each session\n3. Check git status for uncommitted changes\n4. Compile a weekly summary and write it to .pi/journal/weekly-summary.md\n5. Remind the user to commit uncommitted code"
}
```

Every Friday, the AI will automatically:

1. Search all sessions from the week
2. Generate summaries for each one
3. Check git status
4. Generate a weekly report
5. Remind you to commit

### Everyday Use of Scheduled Reminders

```
User: "Remind me to check CI results in 30 minutes"
AI: ✅ Scheduled task created, reminder in 30 minutes

... 30 minutes later ...

AI: ⏰ Reminder: Time to check CI results. Current time: 15:30.
```

## Real-world Example: Sub-agent Research

### Scenario: Researching Best Practices for a New Technology

You say: "Research the performance differences between Bun and Node.js and give me a recommendation."

The AI launches a research workflow:

```
🔬 Research workflow started

Sub-agent 1 (Search Expert):
  → Search "Bun vs Node.js performance benchmark 2026"
  → Found 5 technical articles
  → Extract key data points

Sub-agent 2 (Source Expert):
  → Search Bun's GitHub repository
  → Browse the benchmark directory
  → Review performance discussions in issues

Sub-agent 3 (History Expert):
  → Search project's historical sessions
  → Check if similar evaluations were discussed before

─────────────────────────

Main agent comprehensive report:

📊 Bun vs Node.js Recommendation

1. Performance comparison:
   - HTTP throughput: Bun is 3-4x faster
   - Startup time: Bun is 5x faster
   - npm compatibility: Node.js is better (Bun 95% compatible)

2. Recommendation for this project: Stick with Node.js
   - Rationale: The project depends on multiple Node.js native modules
   - Bun's compatibility issues could lead to extra maintenance costs
   - The performance difference has little impact on this project (I/O bound)
```

### Advantages of Sub-agents

| Feature | Single Agent (Normal Chat) | Multi-agent (Workflow) |
|---------|---------------------------|------------------------|
| Context isolation | All information mixed together | Each sub-agent is independent |
| Parallel execution | Sequential, one by one | Can search in parallel |
| Error isolation | One error affects everything | Sub-agent errors don't affect others |
| Token efficiency | All information in main context | Only final results return to main context |

## Scheduler Configuration

Install via `settings.json`:

```json
{
  "packages": ["pi-scheduler"]
}
```

The tool provides three operations:

| Operation | Description | Parameters |
|-----------|-------------|------------|
| `create` | Create a scheduled task | `interval_ms`, `prompt`, `recurring` |
| `list` | View all tasks | None |
| `cancel` | Cancel a task | `id` |

### Common Time Intervals

| Interval | interval_ms | Use case |
|----------|-------------|----------|
| 30 minutes | 1,800,000 | Short-term reminders |
| 2 hours | 7,200,000 | Periodic checks |
| Daily | 86,400,000 | Daily report / daily check |
| Weekly | 604,800,000 | Weekly report / weekly check |

## Workflow Configuration

Install via `settings.json`:

```json
{
  "packages": ["pi-workflow"]
}
```

Workflow provides two core concepts:

1. **Factor Research**: Multi-round search + evaluation + synthesis
2. **Factor Optimization**: Initial screening + dissection + combination + iteration + validation

Usually you don't need to interact with Workflow directly — the AI automatically decides whether to use sub-agents based on task complexity.

## Best Practices

### ✅ Good Scheduled Task Design

- **Clear instructions**: Tell the AI exactly what to do, avoid vague "check it out"
- **Reasonable intervals**: Don't check every 5 minutes (wastes resources)
- **Meaningful triggers**: A reminder should say "do X now," not "are you there"

### ✅ Good Sub-agent Design
