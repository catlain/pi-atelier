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

Shepherd is a **rule-driven event hook engine** that checks AI actions before and after key moments — think of it as a security guard.

```
AI about to execute an action (tool call)
     │
     ▼
┌──────────────────────────────────┐
│     Shepherd tool_call hook      │
│   Check: Should it be done?      │
│          How should it be done?  │
└──────┬───────────────────────────┘
       │
   ┌───┴────┐
   │        │
  Allow   Rewrite/Block + Show Reason

... tool executes ...

┌──────────────────────────────────┐
│    Shepherd tool_result hook     │
│    Check: Any follow-up needed?  │
└──────┬───────────────────────────┘
       │
   Inject reminder / Append action
```

Supported hook timings:

| Hook | When It Triggers | Typical Use Case |
|------|-----------------|-----------------|
| `tool_call` | **Before** AI calls a tool | Rewrite commands, block dangerous operations |
| `tool_result` | **After** tool execution | Auto-remind to run tests, lint checks |
| `agent_end` | **When** AI finishes a conversation | Remind to commit code, update memory |
| `session_shutdown` | **When** a session closes | Clean up temporary data |

Shepherd's four actions:

| Action | Effect | Typical Use Case |
|--------|--------|-----------------|
| `block` | Prevents tool execution | Block dangerous operations |
| `notify` | Injects a reminder into AI context | "You edited a TS file, remember to run tests" |
| `steer` | Silently injects guidance (not visible to user) | Guide the AI to consult documentation |
| `rewrite` | Modifies tool call parameters | Auto-prepend prefix to commands |

### Second Line: pi-context-manager — Information Quality & Diagnostics

Context Manager controls what information the AI sees, and also helps you diagnose token consumption issues.

Core capabilities:

- **Distill**: Automatically compresses large tool outputs, preserving key information
- **Tool Result Processor**: Formats and simplifies output from specific tools
- **Aging**: Automatically evicts old tool outputs that haven't been referenced in a while
- **Payload Analysis**: Diagnoses where tokens are being spent with data

```
Tool returns large output (potentially 50KB)
     │
     ▼
┌────────────────────────┐
│   Context Manager       │
│   Distill + Processor   │
│   Compress to ~5KB      │
│   key information       │
└────────────────────────┘
     │
     ▼
AI sees refined information and makes better decisions
```

For detailed principles, see [3.3 Context Manager Deep Dive](./context.md).

## Real-World Examples: Preventing AI Mistakes

### Scenario 1: Auto-Remind to Run Tests After Edit

```json
{
	"comment": "[TypeScript] Must run tests after editing",
	"hook": "tool_result",
	"tool": "edit",
	"action": "notify",
	"conditions": [
		{ "field": "path", "pattern": "\\.ts$", "flags": "" }
	],
	"reason": "Edited a TypeScript file. You must run unit tests covering this code (add tests if none exist) and fix all test issues to ensure they pass.",
	"enabled": true
}
```

When the AI edits a `.ts` file, Shepherd automatically reminds the AI to run tests.

### Scenario 2: Session-End Reminder to Commit Code

```json
{
	"comment": "[Wrap-up] Remind to commit + update memory + summary after edits",
	"hook": "agent_end",
	"action": "notify",
	"check": "has_edits",
	"reason": "Detected file edits. Perform wrap-up:\n1️⃣ Git commit...\n2️⃣ Update memory...\n3️⃣ Session summary",
	"stopReason": ["stop"],
	"enabled": true
}
```

`check: "has_edits"` means it only triggers when the session actually edited files. `stopReason: ["stop"]` means it only triggers when the AI ends normally (not when interrupted).

### Scenario 3: Auto-Rewrite Commands

```json
{
	"comment": "[rtk] Auto-proxy frequent bash commands",
	"tool": "bash",
	"action": "rewrite",
	"pattern": "^(git\\s+(status|log|diff)|cargo\\s+(test|build|clippy)|pytest)\\b",
	"flags": "",
	"reason": "rtk command rewrite: auto prepend rtk prefix to compress output",
	"enabled": true
}
```

When the AI tries to run commands like `git status`, Shepherd automatically rewrites it as `rtk git status` (rtk is an output compression tool).

### Scenario 4: Code Style Check

```json
{
	"comment": "[TS] No space indentation - TS files must use Tab",
	"hook": "tool_call",
	"tool": "edit",
	"action": "notify",
	"conditions": [
		{ "field": "path", "pattern": "\\.ts$", "flags": "" },
		{ "field": "text", "pattern": "\\n  [\\S ]", "flags": "" }
	],
	"reason": "❌ TS files require Tab indentation, not spaces. Please rewrite the code using Tab indentation.",
	"enabled": true
}
```

**Both conditions must be met** to trigger: the file is `.ts` and the code contains space indentation.

### Scenario 5: Remind to Check Memory After Repeated Errors

```json
{
	"comment": "[debug] Remind to check memory when tools repeatedly fail",
	"hook": "tool_result",
	"action": "steer",
	"state": { "countKind": "errors", "gte": 5 },
	"reason": "🔍 **Tools repeatedly failing**: Multiple consecutive failures. Check memory files under .pi/memory/ to see if there are existing records of this pitfall.",
	"enabled": true,
	"subagent": false
}
```

`state` implements **state tracking** — Shepherd remembers the error count and only triggers when it reaches the threshold. `subagent: false` means this rule does not trigger in sub-agents.

## Shepherd Rule Configuration Reference

### Rule File Locations

| Level | Path | Description |
|-------|------|-------------|
| Global default | `rules.json` inside the extension package | Built-in rule set for Shepherd |
| Project-level | `.pi/shepherd-rules-*.json` (project root) | Custom project rules, can create multiple files |

After modifying rule files, run `/reload` to apply changes — no need to restart pi.

### Rule Fields Reference

| Field | Required | Description |
|-------|----------|-------------|
| `comment` | ✅ | Rule comment for readability |
| `hook` | ✅ | Trigger timing: `tool_call` / `tool_result` / `agent_end` / `session_shutdown` (default: `tool_call`) |
| `tool` | ❌ | Restrict to a specific tool (e.g. `"edit"`, `"bash"`, `"grep"`; default: `"bash"`) |
| `action` | ✅ | Action: `block` / `notify` / `rewrite` / `steer` (default: `block`) |
| `conditions` | ❌ | Array of conditions — all conditions must be met to trigger |
| `pattern` | ❌ | Regex match (matches tool parameters or command content) |
| `reason` | ✅ | Prompt text injected into AI context (for `notify`/`steer` actions) |
| `state` | ❌ | State tracking (e.g. cumulative error count) |
| `check` | ❌ | agent_end/session_shutdown specific checks: `has_edits` / `git_uncommitted` / `always` |
| `stopReason` | ❌ | Restrict AI stop reasons (e.g. `["stop"]` only triggers on normal end) |
| `subagent` | ❌ | Whether to trigger in sub-agents (default: `true`) |
| `requireSuccess` | ❌ | Whether to trigger only on tool success (default: `false`) |
| `requiresTools` | ❌ | Restrict to trigger only when certain MCP tools are available |
| `enabled` | ✅ | Whether the rule is enabled |

### Condition Matching

Each element in the `conditions` array:

```json
{
	"field": "path",     // Which field to match: path (file path) or text (tool parameter content)
	"pattern": "\\.ts$", // Regex pattern
	"flags": ""          // Regex flags (e.g. "i" for case-insensitive, "s" for single-line mode)
}
```

### Three-Layer Config Merge

Shepherd's configuration (e.g. `projectRulesPattern`, `maxWarnings`) uses pi-shared-utils' `getEffectiveConfig` for three-layer merging:

```
defaults → global ~/.pi/agent/settings.json → project .pi/settings.json
```

You can override Shepherd's configuration in `.pi/settings.json`:

```json
{
	"shepherd": {
		"projectRulesPattern": "my-rules-",
		"maxWarnings": 3
	}
}
```

## Configuring Context

pi-context-manager provides the following commands:

| Command | Purpose |
|---------|---------|
| `/record [on\|off]` | Toggle payload recording |
| `/context` | TUI panel: visualize context usage |
| `/distill-config [N]` | View/set distill token threshold |
| `/distill-config --cap [N]` | View/set first-seen full text cap (`firstSeenCap`, 0 = no cap) |
| `/processor-config [N\|off]` | View/set tool-result-processor threshold |
| `/aging-config [N\|off]` | View/set aging eviction rounds |
| `/context-clean [sessionId]` | Clean up persistent data |

> 💡 **All commands show current config and usage when called without arguments.** For example, entering `/distill-config` directly displays the current threshold and usage instructions.

For detailed principles, see [3.3 Context Manager Deep Dive](./context.md).

## Best Practices

### ✅ Good Rule Design

- **Precise conditions**: Use `conditions` to narrow the trigger scope — don't use a sledgehammer
- **Clear messaging**: Tell the AI "why it's not allowed" and "what to do instead"
- **Layered protection**: Use `block` (enforced) for important matters, `notify` (advisory) for minor ones, `steer` (silent) for internal guidance
- **Make use of state tracking**: Reminding after 3 consecutive errors is more effective than reminding every single time

### ❌ Bad Rule Design

- **Too frequent**: `notify` on every tool call — the AI would be flooded with reminders
- **Too draconian**: `deny` all `bash` commands — the AI can't even run `ls`
- **Vague messaging**: `"reason": "Caution"` — caution about what?
- **Ignoring sub-agents**: Some rules should use `"subagent": false` to exclude sub-agent scenarios and avoid interfering with independent tasks

### Rule Priority

When multiple rules match simultaneously:

1. `block` > `notify` > `steer` (block > remind > silent guidance)
2. At the same priority, rules execute in definition order within the rule file
3. In the `agent_end` hook, rules whose `check` condition is not met are skipped

## Next Up

With memory, planning, and rules in place, the AI is already a reliable assistant. But after a session accomplishes many things — how do you know exactly what it did? Which files were changed? What decisions were made?

In the next chapter, we'll look at how to teach the AI to **review its own work**.
