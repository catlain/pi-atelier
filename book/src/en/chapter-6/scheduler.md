# 6.2 pi-scheduler: Scheduled Tasks

> pi-scheduler is the "alarm clock" of pi-atelier — it can automatically inject messages to the AI at specified times, enabling the AI to proactively execute tasks.

## Why Scheduled Tasks?

The AI is reactive — it only answers when you ask. But some things need to happen **on time**:

- "Remind me to check CI results in 30 minutes" — you might forget
- "Check tests every 2 hours" — manual reminders are tiring
- "Remind me to commit before leaving work every day" — afraid of forgetting

The Scheduler gives the AI "time awareness."

## How It Works

```
Create a scheduled task
     │
     ▼
┌──────────────────┐
│  Scheduler Timer  │
│  Countdown wait   │
└────────┬─────────┘
         │ Time's up!
         ▼
┌──────────────────┐
│  Inject preset    │
│  message into     │
│  AI's context     │
└────────┬─────────┘
         │
         ▼
     AI reads message
     Executes task automatically
```

Key points:
- **Injecting a message** does not start a new conversation — it inserts a "reminder" into the current session
- The AI **decides for itself** how to execute after seeing the message, no need for you to repeat it
- Scheduled tasks are only valid in the current session; they are cleared when the session ends

## Three Operations

### Creating a Task

```
schedule(
  action="create",
  interval_ms=1800000,    // 30 minutes
  prompt="Check CI build results, tell me if it fails",
  recurring=false          // One-shot
)
```

Parameter description:

| Parameter | Description | Required |
|-----------|-------------|----------|
| `action` | Fixed as `"create"` | ✅ |
| `interval_ms` | Interval in milliseconds | ✅ |
| `prompt` | Message to inject to the AI | ✅ |
| `recurring` | Whether to repeat (default: false) | ❌ |

### Listing Tasks

```
schedule(action="list")

Result:
  📋 Current scheduled tasks:
  1. [One-shot] Trigger at 14:30 — "Check CI results"
  2. [Recurring] Every 2h — "Run tests for regressions"
```

### Canceling a Task

```
schedule(action="cancel", id="task-123")
```

## Common Time Intervals

| Scenario | Interval | interval_ms |
|----------|----------|-------------|
| Short-term reminder | 5 minutes | 300,000 |
| Tea break | 15 minutes | 900,000 |
| Waiting for build | 30 minutes | 1,800,000 |
| Periodic check | 2 hours | 7,200,000 |
| Daily reminder | 1 day | 86,400,000 |

## One-shot vs Recurring Tasks

### One-shot (recurring=false)

Best for "reminder" scenarios:

```
User: "Remind me about the meeting in 30 minutes"

AI → schedule(action="create", interval_ms=1800000,
              prompt="⏰ Reminder: Time for the meeting.", recurring=false)

... 30 minutes later ...

AI: ⏰ Reminder: Time for the meeting. Current time: 15:30.
```

Automatically deleted after being triggered once.

### Recurring (recurring=true)

Best for "periodic check" scenarios:

```
User: "Run tests every 2 hours"

AI → schedule(action="create", interval_ms=7200000,
              prompt="Please run npm test and report results. If it fails, list the failing tests.",
              recurring=true)

... Every 2 hours ...

AI: 📋 Periodic test report: All 47 tests passed ✅
...
AI: ⚠️ Periodic test report: 2 tests failed!
    - auth.test.ts: Login timeout
    - api.test.ts: 404 error
```

## Status Bar Integration

The Scheduler displays a countdown in pi's status bar, so you always know when the next reminder will trigger.

## Notes

- Scheduled tasks **only work in the current session** — tasks disappear when the session is closed
- Recurring tasks shouldn't have intervals that are too short (recommended ≥ 5 minutes), to avoid frequent triggers wasting tokens
- The **prompt should be specific and clear** — the AI sees this exact text; vague instructions lead to vague execution

## Next Steps

> 📖 Return to [6.1 Automation & Workflows](./automation.md) for complete usage examples.
