# 3.5 Shepherd in Practice: Real-World Scenarios

> This section demonstrates how to use Shepherd rules to solve common problems in AI-assisted coding through real-world scenarios.

## Scenario 1: Auto-Prompt for Running Tests After Code Edits

### Problem

The AI modifies TypeScript code but forgets to run tests. You have to manually say "run the tests" every time.

### Rule

```json
{
	"comment": "[TypeScript] Must run tests after edits",
	"hook": "tool_result",
	"tool": "edit",
	"action": "notify",
	"conditions": [
		{ "field": "path", "pattern": "\\.ts$", "flags": "" }
	],
	"reason": "You edited a TypeScript file. You must run unit tests covering the code (add tests first if none exist) and fix all issues to ensure they pass.",
	"enabled": true
}
```

### Effect

```
AI: I modified the null-check logic in src/auth/login.ts.
🛡️ Shepherd reminds: You edited a TypeScript file. You must run unit tests covering the code.
AI: Got it, let me run the tests... ✅ All 3 tests pass.
```

## Scenario 2: Preventing the AI from Messing with Others' Code

### Problem

You're working in a team project. A colleague has uncommitted changes in the workspace. The AI sees "something wrong here" and casually runs `git checkout` to restore their files.

### Rule

```json
{
	"comment": "[Safety] Block git checkout -- to restore files",
	"hook": "tool_call",
	"tool": "bash",
	"action": "block",
	"conditions": [
		{ "field": "text", "pattern": "git\\s+checkout\\s+--", "flags": "" }
	],
	"reason": "❌ Blocked: git checkout -- to restore files! There are uncommitted changes from others in the workspace — you don't have the authority to decide which changes are 'unrelated'.",
	"enabled": true
}
```

### Effect

```
AI prepares to run: git checkout -- src/config.ts
🛡️ Shepherd blocks: git checkout -- to restore files is not allowed!
AI: Sorry, I won't restore other people's files. Let me find another approach...
```

## Scenario 3: Auto-Commit Code at Session End

### Problem

The AI modified a bunch of files, the session ends, but the code isn't committed. The next day, the workspace is a mess.

### Rule

```json
{
	"comment": "[Wrap-up] Prompt for commit + memory update + summary after edits",
	"hook": "agent_end",
	"action": "notify",
	"check": "has_edits",
	"reason": "File edits detected. Perform wrap-up tasks:\n1️⃣ Git commit...\n2️⃣ Update memories...\n3️⃣ Session summary",
	"stopReason": ["stop"],
	"enabled": true
}
```

`check: "has_edits"` ensures the notification only triggers when files were actually modified, avoiding interference in pure chat sessions. `stopReason: ["stop"]` ensures it only fires on normal termination, not interruptions.

## Scenario 4: Auto-Prompt for Architecture Check After .gd File Edits

### Problem

You're working on a Godot game project. After the AI edits `.gd` files, it should run architecture checks and formatting checks — but you have to remind it manually every time.

### Rule (multiple rules can be defined for the same file, executed in order)

```json
{
	"comment": "[arch] Prompt for compilation validation after .gd edits",
	"hook": "tool_result",
	"tool": "edit",
	"action": "notify",
	"conditions": [
		{ "field": "path", "pattern": "\\.gd$", "flags": "" }
	],
	"reason": "You edited a .gd file. Please run check_arch to verify architecture compliance.",
	"enabled": true
},
{
	"comment": "[format] Prompt for formatting check after .gd edits",
	"hook": "tool_result",
	"tool": "edit",
	"action": "notify",
	"conditions": [
		{ "field": "path", "pattern": "\\.gd$", "flags": "" }
	],
	"reason": "You edited a .gd file. Please run gdformat for formatting checks.",
	"enabled": true
}
```

Both rules will fire, and the AI will run the architecture check followed by the formatting check.

## Scenario 5: Auto-Prompt to Check Memory on Repeated Tool Errors

### Problem

The AI keeps hitting errors — `edit` match failures, missing `bash` commands, tests failing repeatedly. It's circling in the same dead end.

### Rule

```json
{
	"comment": "[debug] Prompt to check memory on repeated tool errors",
	"hook": "tool_result",
	"action": "steer",
	"state": { "countKind": "errors", "gte": 5 },
	"reason": "🔍 **Repeated tool errors**: Failed multiple times consecutively. Check the memory files under .pi/memory/ directory for existing troubleshooting records.",
	"enabled": true,
	"subagent": false
}
```

Key points:
- `state: { "countKind": "errors", "gte": 5 }` — only triggers after 5 consecutive errors, won't bother you every time
- `action: "steer"` — silently injects guidance, invisible to the user interface
- `subagent: false` — won't fire in sub-agents, avoiding interference with independent tasks

### Effect

```
AI tries edit, fails...
AI tries edit, fails...
AI tries bash sed, fails...
AI tries edit, fails...
AI tries edit, fails...
🛡️ Shepherd silently guides: Check the memory files.
AI: Let me check the memories... Found it! The memory file says "when edit match fails, first check for CRLF".
AI: Running audit_format.py to check format... It is indeed a CRLF issue.
```

## Scenario 6: Auto-Rewriting High-Frequency Commands

### Problem

The AI frequently runs commands like `git status`, `git log`, `npm test`, etc. Their output can be lengthy, wasting tokens.

### Rule

```json
{
	"comment": "[rtk] Auto-proxy frequent bash commands",
	"tool": "bash",
	"action": "rewrite",
	"pattern": "^(git\\s+(status|log|diff)|cargo\\s+(test|build|clippy)|pytest)\\b",
	"flags": "",
	"reason": "rtk command rewrite: auto-prepend rtk prefix to compress output",
	"enabled": true
}
```

When the AI runs `git status`, Shepherd automatically rewrites it to `rtk git status` (rtk is an output compression tool), reducing token consumption. The AI doesn't need to know about this rewrite — to it, the result just looks cleaner.

## Rule Design Pattern Summary

| Pattern | Action | Use Case |
|---------|--------|----------|
| **Post-edit reminder** | `notify` + `conditions` | Run tests, lint, formatting after code changes |
| **Dangerous operation block** | `block` + `conditions` | Block `git checkout --`, prevent file deletion |
| **Session wrap-up automation** | `agent_end` + `check` | Auto-commit + memory update at session end |
| **Repeated error guidance** | `steer` + `state` | Guide the AI to check memories when it keeps failing |
| **Command rewriting** | `rewrite` + `pattern` | Auto-prepend prefix to compress command output |

> 📖 Return to [3.1 Setting Rules for AI](./rules.md) for the complete rule field reference.


Original: /home/lain/.pi/agent/distill/processor/read-b63ebc90-1779883939894.txt
