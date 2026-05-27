# Appendix

## A. Extension Quick Reference

| Extension | Install Command | Core Tools/Commands | One-Liner Purpose |
|-----------|----------------|-------------------|-------------------|
| pi-memory | `"pi-memory"` | `memory_update`, `memory_index` | Cross-session knowledge persistence |
| pi-roadmap | `"pi-roadmap"` | `roadmap_plan`, `roadmap_next`, `roadmap_done`, etc. | Task breakdown and progress tracking |
| pi-shepherd | `"pi-shepherd"` | Rule-driven hook engine | AI behavior guard (no tools/commands) |
| pi-context-manager | `"pi-context-manager"` | `payload_analyze`, `/record`, `/context`, `/distill-config`, `/aging-config`, etc. | Context quality control + Token diagnostics |
| pi-session-analyzer | `"pi-session-analyzer"` | `session_search`, `session_analyze` | Historical session search and review |
| pi-smart-compact | `"pi-smart-compact"` | `/smart-compact`, `/smart-compact-config` | Intelligent long-session compression |
| pi-scheduler | `"pi-scheduler"` | `schedule`, `/loop`, `/remind`, `/tasks` | Scheduled tasks and reminders |
| pi-workflow | `"pi-workflow"` | `registerWorkflowTool` (called by other extensions) | Workflow framework library |
| pi-shared-utils | `"pi-shared-utils"` | logger, storage, paths, json, validator, settings-backup, file-lock | Extension development utility library |
| pi-journal | `"pi-journal"` | `/journal`, `journal` | Log report generation (git activity + session events + memory changes) |

## B. Recommended Extension Combos

### Personal Projects (Lightweight Combo)

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-smart-compact"
  ]
}
```

Core three: Remember knowledge + Manage tasks + Stay smart in long sessions.

### Team Projects (Standard Combo)

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-shepherd",
    "pi-session-analyzer",
    "pi-smart-compact"
  ]
}
```

Adds rules and retrospective capabilities.

### Large Refactors (Full Combo)

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-shepherd",
    "pi-context-manager",
    "pi-session-analyzer",
    "pi-smart-compact",
    "pi-scheduler"
  ]
}
```

Full installation, fully leveraging diagnostics and automation capabilities.

## C. pi Internal Mechanics Overview

### Compaction

pi has a built-in context compression mechanism. When the conversation history approaches the context window limit, pi automatically compresses older conversations. The Smart Compact extension enhances this mechanism — it identifies critical information (decisions, conventions, conclusions) and prioritizes preserving it.

### Distill

Tool results can be very large (e.g., reading a 1000-line file). pi has a built-in distill mechanism to compress tool output. The pi-context-manager extension provides:
- **Auto Distill**: Automatically compresses tool output exceeding the threshold (`/distill-config`)
- **First Full Content Cap**: `firstSeenCap` (`/distill-config --cap`) limits the initial output size
- **Tool Result Processor**: Format-specific streamlining for certain tool types (`/processor-config`)
- **Aging**: Automatically evicts old tool output (`/aging-config`)

### Tool Call Lifecycle

```
1. AI decides to call a tool
     │
     ▼
2. Shepherd tool_call hook (rewrite / block / notify / steer)
     │
     ▼
3. Execute tool
     │
     ▼
4. Context Manager distill + processor processes the return value
     │
     ▼
5. Shepherd tool_result hook (notify / steer)
     │
     ▼
6. Result returned to AI
```

### Session Storage

All session data is stored under the `~/.pi/` directory:

```
~/.pi/
├── roadmap/              # Global roadmaps
└── agent/
    ├── settings.json         # Global config (installed extensions, providers)
    ├── mcp.json              # MCP server configuration
    ├── memory/               # Global memory files (L1)
    ├── skills/               # Global skills
    ├── extensions/           # Inline extensions
    ├── agents/               # Sub-agent definitions
    ├── npm/node_modules/     # npm-installed extension packages
    ├── git/                  # Git package installation location
    ├── sessions/             # Session history records (JSONL)
    ├── distill/              # context-manager data
    │   └── recordings/       # Payload recordings

{project}/.pi/
├── settings.json         # Project-level config (overrides global)
├── memory/               # Project-level memory (L2)
└── roadmap/              # Project-level roadmaps
```

## D. Frequently Asked Questions

### Q: Extension not taking effect after installation?

Check:
1. Whether `settings.json` format is correct (JSON syntax)
2. Whether the package name is spelled correctly
3. Restart pi (extensions need a restart to be loaded)

### Q: Too many memory files?

pi-memory automatically checks the file count. It's recommended to clean up when exceeding 25 files; writes are refused beyond 40. Cleanup methods:
1. Merge multiple files on the same topic
2. Delete outdated memories
3. Split large files into smaller ones

### Q: Shepherd rules not working?

Check:
1. Global rules are in the pi-shepherd package's `rules.json`
2. Project rules go in `.pi/shepherd-rules-*.json` (note the file name prefix)
3. Confirm `"enabled": true` in the rule
4. Type `/reload` to reload rules

### Q: Token consumption too fast?

1. Use `payload_analyze` with `budget` and `expensive` modes to identify token hogs
2. Use compact mode for searches (`semantic_code_search(compact: true)`)
3. Lower the distill threshold (`/distill-config`)
4. Configure aging to auto-evict old content (`/aging-config`)

### Q: payload_analyze reports "no recordings"?

You need to enable recording first: `/record on`. Use normally while recording, then `/record off` when done.
