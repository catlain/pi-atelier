# 3.2 How pi-shepherd Works: A Rule-Driven Hook System

> Shepherd is the "nervous system" of pi-atelier — it doesn't provide tools or commands directly, but connects all other extensions through event hooks.

## Architecture Overview

```
pi event bus
     │
     ├─ before_provider_request  ← Shepherd injects ephemeral hints here
     │
     ├─ tool_call                ← Shepherd intercepts/rewrites tool calls
     │      │
     │      ▼
     │   Tool executes
     │      │
     │      ▼
     ├─ tool_result              ← Shepherd checks results, triggers follow-up actions
     │
     ├─ agent_end                ← Shepherd triggers wrap-up actions
     │
     └─ session_shutdown         ← Shepherd cleans up ephemeral state
```

## Core Concepts

### Rule

Each rule is a JSON object that defines "**when** to trigger, **under what conditions**, and **what action** to take":

```
Rule = Hook timing(hook) + Match conditions(conditions/pattern) + Action(action) + Prompt(reason)
```

### Action Types in Detail

| Action | Injection Method | User Visible | Typical Use Case |
|--------|------------------|-------------|------------------|
| `notify` | Injects into AI context | ✅ Yes | Remind AI to run tests, lint |
| `steer` | Silent injection | ❌ No | Guide AI to consult documentation |
| `rewrite` | Modifies tool parameters | ✅ Yes | Auto-prepend prefix to commands |
| `block` | Prevents execution | ✅ Yes | Block dangerous operations |

### State Tracking

Shepherd maintains internal state counters for tool calls:

```json
"state": { "countKind": "errors", "gte": 5 }
```

This means "trigger when cumulative errors ≥ 5 times." `countKind` supports:
- `"errors"`: Counts when a tool returns an error
- `"calls"`: Counts when a tool is called

### Cross-Extension Communication

Shepherd receives "hints" from other extensions via the `pi.events` event bus:

```
Other extension emits hint → pi.events.emit("ephemeral:hint") → Shepherd collects
                                                                          │
At before_provider_request → Shepherd injects collected hints into AI context
```

This mechanism allows extensions to collaborate without direct dependencies on each other.

## Rule Loading Flow

```
1. Load rules.json inside the extension package (global default rules)
     │
     ▼
2. Scan project directory for .pi/shepherd-rules-*.json (project rules)
     │
     ▼
3. Rules stack and take effect (project rules override global rules with the same name)
```

The `/reload` command reloads all rules without restarting pi.

## Configuration

Shepherd's configuration uses shared-utils' three-layer merge (defaults → global settings → project settings):

```json
// .pi/settings.json (project-level)
{
	"shepherd": {
		"projectRulesPattern": "shepherd-rules-",  // Project rule file prefix
		"maxWarnings": 5                            // Maximum warning count
	}
}
```

## Next Up

Now that you understand how Shepherd guards AI behavior, the next section covers [how Context Manager controls information quality](./context.md).
