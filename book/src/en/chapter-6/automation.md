# Automation & Workflow

## You've Probably Experienced This

Every Friday afternoon, you do the same things:

1. Review all sessions from the past week to see what files were changed
2. Run tests to make sure there are no regressions
3. Check for any uncommitted code
4. Write a weekly summary — recap the past week's progress

Every time, you have to manually remind the AI to do these things. Sometimes you forget, and on Monday you find out the Friday changes were never committed.

> 💡 **AI can do things, but it won't take the initiative**. You have to tell it "this is what you should do now."

## Two Tools: Scheduler and Workflow

### pi-scheduler — Scheduled Tasks

The scheduler lets AI do specific tasks at specific times:

```
Scheduled Trigger
     │
     ▼
┌──────────────────────┐
│ Inject preset message │
│ "It's Friday afternoon,│
│  please do weekly     │
│  check"               │
└──────────────────────┘
     │
     ▼
  AI Executes Automatically
```

Supported schedule types:

| Type | Description | Example |
|------|-------------|---------|
| One-time | Trigger once after a delay | "Remind me to join the meeting in 30 minutes" |
| Recurring | Trigger repeatedly at fixed intervals | "Check tests every 2 hours" |

### pi-workflow — Sub-Agent Orchestration

Workflow lets the AI break complex tasks into multiple sub-agents that execute in parallel:

```
Main Agent: "Research best practices for XXX"
     │
     ├──→ Sub-agent 1: Search web resources
     ├──→ Sub-agent 2: Search GitHub source code
     └──→ Sub-agent 3: Search historical sessions
          │
          ▼
     Main Agent: Synthesize results from all three sub-agents, provide recommendations
```

Sub-agents are independent execution environments:

- Each has its own context window (won't pollute the main session)
- Each has its own tool set (permissions can be restricted)
- Each returns results to the main agent after execution

## Real-World Example: Automated Weekly Report

### Configuring a Friday Auto-Check

```json
{
  "action": "create",
  "interval_ms": 604800000,
  "recurring": true,
  "prompt": "It's Friday afternoon. Please perform the following checks:\n1. Use session_search to review all sessions from this week\n2. Use session_analyze summary to summarize each session\n3. Check git status for uncommitted changes\n4. Compile a weekly report and write it to .pi/journal/weekly-summary.md\n5. Remind the user to commit any uncommitted code"
}
```

Every Friday, the AI will automatically:

1. Search all sessions from the past week
2. Generate summaries for each one
3. Check git status
4. Generate a weekly report
5. Remind you to commit

### Daily Use of Timed Reminders

```
User: "Remind me in 30 minutes to check the CI results"
AI: ✅ Scheduled task created, will remind you in 30 minutes

... 30 minutes later ...

AI: ⏰ Reminder: Time to check the CI results. Current time: 15:30.
```

## Real-World Example: Sub-Agent Research

### Scenario: Researching Best Practices for a New Technology

You say: "Research the performance differences between Bun and Node.js, and give me a recommendation."

The AI launches a research workflow:

```
🔬 Research Workflow Started

Sub-agent 1 (Search Expert):
  → Search "Bun vs Node.js performance benchmark 2026"
  → Found 5 technical articles
  → Extracted key data points

Sub-agent 2 (Source Code Expert):
  → Search Bun's GitHub repository
  → Look at the benchmark directory
  → Check performance discussions in issues

Sub-agent 3 (History Expert):
  → Search historical sessions in this project
  → Check if similar decisions have been discussed before

─────────────────────────

Main Agent Synthesis Report:

📊 Bun vs Node.js Recommendation

1. Performance Comparison:
   - HTTP throughput: Bun is 3-4x faster
   - Startup time: Bun is 5x faster
   - npm compatibility: Node.js is better (Bun ~95% compatible)

2. Recommendation for this project: Stick with Node.js
   - Rationale: The project depends on several Node.js native modules
   - Bun's compatibility issues could lead to additional maintenance costs
   - Performance differences have limited impact on this project (I/O bound)
```

### Advantages of Sub-Agents

| Feature | Single Agent (Normal Chat) | Multi-Agent (Workflow) |
|---------|---------------------------|----------------------|
| Context Isolation | All information mixed together | Each sub-agent is independent |
| Parallel Execution | Serial, one at a time | Can search in parallel |
| Error Isolation | One error affects everything | Sub-agent errors don't affect others |
| Token Efficiency | All information in main context | Only final results return to main context |

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

| Interval | interval_ms | Use Case |
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

You typically don't need to interact with Workflow directly — the AI automatically decides whether to enable sub-agents based on task complexity.

## Best Practices

### ✅ Good Scheduled Task Design

- **Clear instructions**: Tell the AI exactly what to do, avoid vague instructions like "check things out"
- **Reasonable intervals**: Don't check every 5 minutes (waste of resources)
- **Meaningful triggers**: Reminders should say "it's time to do X," not "are you there?"

### ✅ Good Sub-Agent Design

- **Single responsibility**: Each sub-agent does one thing only
- **Clear output**: Sub-agents should return structured results, not free-form text
- **Moderate parallelism**: 3-5 sub-agents is the sweet spot; too many increases synthesis complexity

### ❌ Common Pitfalls

- "Scheduled tasks can replace all manual operations" → No, complex decisions still need human involvement
- "More sub-agents is always better" → Too many sub-agents may cost more to synthesize than the benefit gained
- "Workflow can do anything" → It excels at research and analysis, not decisions requiring human judgment

## Next Steps

So far, we've introduced all the core tools provided by pi-atelier. But what if these tools aren't enough — and you want to build a feature that doesn't exist yet?

In the next chapter, we'll look at how to **develop extensions** on your own.
