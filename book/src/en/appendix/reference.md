# Appendix

## A. Extension Quick Reference

| Extension | Install | Core Tools | One-liner |
|-----------|---------|------------|-----------|
| pi-memory | `"pi-memory"` | `memory_update`, `memory_index` | Cross-session knowledge persistence |
| pi-roadmap | `"pi-roadmap"` | `roadmap_plan`, `roadmap_next`, `roadmap_done` | Task breakdown and progress tracking |
| pi-shepherd | `"pi-shepherd"` | Hook rule engine | AI behavior guard |
| pi-context-manager | `"pi-context-manager"` | distill + filter + `payload_analyze` | Context quality control + Token diagnostics |
| pi-scheduler | `"pi-scheduler"` | `schedule` | Scheduled tasks and reminders |
| pi-workflow | `"pi-workflow"` | Sub-agent orchestration | Complex research automation |
| pi-shared-utils | `"pi-shared-utils"` | logger, storage, paths, json, validator | Extension development toolkit |

## B. Recommended Extension Combinations

### Personal Projects (Lightweight)

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-smart-compact"
  ]
}
```

Core trio: remember knowledge + manage tasks + keep long sessions sharp.

### Team Projects (Standard)

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-shepherd",
    "pi-journal",
    "pi-session-analyzer",
    "pi-smart-compact"
  ]
}
```

Adds rules, logging, and retrospective capabilities.

### Large Refactoring (Full Suite)

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-shepherd",
    "pi-context-manager",
    "pi-journal",
    "pi-session-analyzer",
    "pi-smart-compact",
    "pi-scheduler",
    "pi-workflow"
  ]
}
```

Full install, leveraging all automation and diagnostic capabilities.

## C. pi Internal Mechanisms at a Glance

### Compaction

pi has built-in context compression. When conversation history approaches the context window limit, pi automatically compresses older conversations. The Smart Compact extension enhances this mechanism — it identifies critical information (decisions, conventions, conclusions) and prioritizes their retention.

### Distill

Tool results can be large (e.g., reading a 1000-line file). pi has a built-in distill mechanism to compress tool outputs. The pi-context-manager extension allows custom distill strategies and provides the `payload_analyze` tool for token consumption diagnostics.

### Tool Call Lifecycle

```
1. AI decides to call a tool
     │
     ▼
2. Shepherd hook check (before_*)
     │
     ▼
3. Execute tool
     │
     ▼
4. Context Manager distill processes the return value
     │
     ▼
5. Shepherd hook check (after_*)
     │
     ▼
6. Result returned to AI
```

### Session Storage

All session data is stored in the `.pi/sessions/` directory:

```
.pi/
├── distill/         # pi-context-manager distill data
├── memory/          # pi-memory memory files
├── roadmaps/        # pi-roadmap roadmap JSONs
├── sessions/        # Raw session data
├── journal/         # pi-journal logs
└── config.json      # Project-level configuration
```

## D. FAQ

### Q: Extension installed but not working?

Check:
1. Is `settings.json` properly formatted (valid JSON)?
2. Is the package name spelled correctly?
3. Restart pi (extensions require a restart to load)

### Q: Too many memory files?

pi-memory automatically checks the file count. It recommends cleanup when exceeding 25 files and refuses writes beyond 40. Cleanup methods:
1. Merge files on the same topic
2. Delete outdated memories
3. Split large files into smaller ones

### Q: Shepherd rules not taking effect?

Check the format and location of `rules.json`. Rule files should be at `shepherd/rules.json` (project-level) or `~/.pi/agent/shepherd/rules.json` (global).

### Q: Token consumption too fast?

Use `payload_analyze` with `budget` and `expensive` modes to identify token-heavy operations, then use compact mode search or distill to reduce consumption.
