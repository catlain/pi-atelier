# Setting Rules for AI

## You've Probably Seen This Before

You ask the AI to "fix the login page styles." 30 seconds later you check the code —

The AI didn't just fix the styles. It also:
- "Conveniently" refactored the entire login component directory structure
- Switched CSS modules to Tailwind (your project doesn't use Tailwind)
- Deleted 3 test files it deemed "unnecessary"
- Upgraded all dependencies in package.json to the latest versions

By the time you notice, the code has already been committed.

> 💡 **The more capable the AI, the more it needs rules.** Without boundaries, greater capability only causes greater damage.

## Two Lines of Defense: Shepherd and Context

pi-atelier provides two layers of protection:

### First Line: pi-shepherd — The Behavior Guard

Shepherd checks AI actions before they execute — think of it as a security guard.

```
AI about to execute an action
     │
     ▼
┌──────────────────┐
│  Shepherd Hook   │
│  Check: Should   │
│  this be allowed?│
└──────┬───────────┘
       │
   ┌───┴───┐
   │       │
  Allow  Block + Show Reason
```

Available hook timings:

| Hook | When It Triggers | Typical Use Case |
|------|-----------------|-----------------|
| `before_edit` | Before AI edits a file | Check if it's modifying protected files |
| `before_write` | Before AI creates a new file | Validate file path is reasonable |
| `before_bash` | Before AI executes a command | Block dangerous commands (`rm -rf /`) |
| `after_bash` | After command execution | Auto-format, lint checking |
| `agent_end` | Before session ends | Remind to commit code, update docs |

### Second Line: pi-context-manager — Information Quality & Diagnostics

Context Manager controls not only what the AI sees, but also helps you diagnose token consumption issues.

The AI's "intelligence" directly depends on the quality of its context. If the context contains noise (stale logs, irrelevant file content), the AI will make wrong decisions.

pi-context-manager's core capabilities:

- **Distill**: Compress large tool outputs down to key information
- **Filter**: Block irrelevant content based on rules
- **Priority Sort**: Put important information first
- **Token Diagnostics**: Data-driven analysis — see exactly where tokens are being spent

```
Tool returns large output (potentially 50KB)
     │
     ▼
┌──────────────────┐
│  Context Distill │
│  Compress to 5KB │
│  Key Information │
└──────────────────┘
     │
     ▼
AI sees refined information and makes better decisions
```

## Real-World Examples: Preventing AI Mistakes

### Scenario 1: Protect System Files

```json
{
  "rules": [
    {
      "id": "no-system-files",
      "hook": "before_edit",
      "condition": "filePath matches '.pi/memory/.*'",
      "action": "deny",
      "message": "Memory files can only be modified through the memory_update tool, not by direct editing"
    }
  ]
}
```

When the AI tries to use the `edit` tool to directly modify a memory file, shepherd intercepts and tells it the proper way.

### Scenario 2: Session-End Reminder

```json
{
  "rules": [
    {
      "id": "commit-reminder",
      "hook": "agent_end",
      "action": "inject",
      "message": "Check for uncommitted changes. If any exist, commit and push to the remote repository."
    }
  ]
}
```

The AI automatically checks git status before the session ends, ensuring nothing is left uncommitted.

### Scenario 3: Auto Lint

```json
{
  "rules": [
    {
      "id": "auto-lint",
      "hook": "after_bash",
      "condition": "command matches 'edit|write'",
      "action": "run",
      "command": "npx eslint {filePath}"
    }
  ]
}
```

Every time the AI edits a file, lint runs automatically to maintain code quality.

## Configuring Shepherd Rules

Rules are stored in `shepherd/rules.json`. Each rule contains:

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Unique rule identifier | `"no-system-files"` |
| `hook` | Trigger timing | `"before_edit"` |
| `condition` | Trigger condition (optional) | `"filePath matches 'src/.*'"` |
| `action` | Action to take | `"deny"` / `"inject"` / `"run"` |
| `message` | Prompt message | `"Do not directly edit memory files"` |

### Common Rule Templates

```json
{
  "rules": [
    {
      "id": "protect-config",
      "hook": "before_edit",
      "condition": "filePath matches '(package\\.json|tsconfig\\.json)$'",
      "action": "warn",
      "message": "You are about to modify a configuration file — please confirm this is intentional"
    },
    {
      "id": "no-force-push",
      "hook": "before_bash",
      "condition": "command matches 'push.*--force'",
      "action": "deny",
      "message": "Force push is prohibited — it overwrites remote history"
    },
    {
      "id": "test-reminder",
      "hook": "agent_end",
      "action": "inject",
      "message": "Run tests to confirm everything passes before committing"
    }
  ]
}
```

## Configuring Context

pi-context-manager is installed via the `packages` field in `settings.json` (package name: `"pi-context-manager"`). It provides by default:

- Automatic distill of large tool outputs
- Priority-ordered context
- `payload_analyze` tool — analyze token budget, growth trends, most expensive tool calls
- Global prompt injection via AGENTS.md

Advanced users can customize filter rules in `.pi/config.json`.

## Best Practices

### ✅ Good Rule Design

- **Precise conditions**: Only intercept what needs intercepting — don't use a sledgehammer
- **Clear messaging**: Tell the AI "why it's not allowed" and "what to do instead"
- **Layered protection**: Use `deny` (enforced) for important matters, `warn` (advisory) for minor ones

### ❌ Bad Rule Design

- **Too broad**: `"condition": "always"` blocks everything — the AI can't do anything
- **Too draconian**: Blocking all `bash` commands means the AI can't even run `ls`
- **Vague messaging**: `"message": "Caution"` — caution about what?

### Rule Priority

When multiple rules match simultaneously:

1. `deny` > `warn` > `inject`
2. At the same priority, rules defined later take effect first
3. `agent_end` hooks execute in definition order

## Next Up

With memory, planning, and rules in place, the AI is already a reliable assistant. But after a session accomplishes many things — how do you know exactly what it did? Which files were changed? What decisions were made?

The next chapter shows you how to teach the AI to **review its own work**.
