# An AI's Memory

## You've Probably Seen This Before

You're using an AI coding assistant to develop a project. On the first day, you spent half an hour explaining to the AI:

- The project uses Rust + Axum tech stack
- The database is DuckDB, not PostgreSQL
- The auth module uses JWT, not Session
- The deployment target is an ARM-based embedded device

The AI understood, and helped you write perfect code.

The next day, you start a new session and the AI has forgotten everything. It starts suggesting Express.js, connecting to PostgreSQL, using Session auth…

> 💡 **This is the AI's "goldfish memory" problem**: every new session is a blank slate.

## Memory: Giving AI Cross-Session Knowledge

pi-memory is the solution. It gives the AI a "notebook":

- **Auto-record**: Architectural decisions, pitfalls encountered, and consensus reached during the session
- **Auto-load**: At the start of each new session, the AI automatically reads key knowledge from before
- **Per-project isolation**: Memories from different projects don't interfere with each other

### How It Works

```
┌─────────────────────────────────────────┐
│           AI Session                      │
│                                          │
│  ┌──────────┐     ┌──────────────────┐  │
│  │ User      │ ──→ │ AI extracts      │  │
│  │ Dialogue  │     │ knowledge points │  │
│  └──────────┘     └────────┬─────────┘  │
│                            │             │
│                            ▼             │
│                   ┌─────────────────┐    │
│                   │  memory_update   │    │
│                   │  Write memory    │    │
│                   │  file            │    │
│                   └─────────────────┘    │
│                                          │
│  ┌──────────┐     ┌──────────────────┐  │
│  │ New      │ ──→ │ before_agent_start│  │
│  │ Session  │     │ Auto-load memory │  │
│  │ Start    │     │ index            │  │
│  └──────────┘     └──────────────────┘  │
└─────────────────────────────────────────┘
```

### Auto-Injection: Memory Index Loaded Every Turn

At the start of each session (the `before_agent_start` event), pi-memory automatically does the following:

1. **Reads `memory-prompt.md`** — Instructions for using the memory system (tells the AI there's a memory feature and where the files are)
2. **Reads the `MEMORY.md` index** — Global `~/.pi/agent/memory/MEMORY.md` + project `.pi/memory/MEMORY.md`
3. **Injects into the system prompt** — The AI can see all memory titles and keywords right at the start of every turn

This means the AI doesn't need to actively "look up" memories — **the memory index is already in its context**. When the AI sees a title like `JS_replace_$陷阱`, it knows that memory exists and can use the `read` tool to get the full content when needed.

> ⚠️ **Only the index is injected, not the full content**. MEMORY.md only contains titles and keywords, not complete memory content. The AI needs to `read` a specific file to get the details.

The core structure of memory:

| Component | Role |
|------|------|
| `MEMORY.md` | Index file, lists all memory titles and keywords (auto-injected every turn) |
| Memory files (`.md`) | One topic per file, contains specific knowledge (read on demand) |
| `memory_update` tool | AI uses to write/update memory files + auto-update MEMORY.md index |
| `memory_index` tool | AI uses to view existing memories (manual query) |
| `before_agent_start` hook | Auto-injects memory index into system prompt at session start |

### Memory File Format

Each memory file follows a consistent format:

```markdown
# Title

Keywords: `kw1` `kw2` `kw3` ...

## Content

- Knowledge point 1
- Knowledge point 2
- Decision record: why option A was chosen over option B
```

File naming convention: `topic--keyword1,keyword2,keyword3.md`

For example: `database-choice--DuckDB,embedded,ARM,column-store,analytical-queries.md`

## Real-World Case: The First Week of a New Project

Let's look at a real scenario. Say you're developing a data analysis tool:

### Day 1: Project Initialization

You and the AI discussed tech choices and decided on Python + FastAPI + DuckDB. At the end of the session, the AI automatically wrote a memory:

```markdown
# Tech Stack Decision

Keywords: `Python` `FastAPI` `DuckDB` `technology-choice`

## Rationale

- FastAPI: Good async support, auto-generates API documentation
- DuckDB: Embedded analytical database, no separate deployment needed, suitable for single-machine analysis
  - Not PostgreSQL: the project doesn't need concurrent writes; embedded is simpler
- Python 3.12+: uses new type syntax
```

### Day 3: Hitting a Pitfall

You ran into an issue with DuckDB's date handling — the default timezone is UTC, but your users are in China. After the AI helped you solve it, it wrote a memory:

```markdown
# DuckDB Timezone Issue

Keywords: `DuckDB` `timezone` `date` `UTC` `Asia/Shanghai`

## Problem and Solution

DuckDB uses UTC timezone by default. Running `SELECT NOW()` returns UTC time.

Solution: Set `SET timezone = 'Asia/Shanghai'` when connecting.

Note: Don't do timezone conversion at the SQL level — handle it in the Python layer with datetime for reliability.
```

### Day 7: New Session, No Repetition Needed

You start a new session and say "add a CSV export feature to the analysis API." The AI already knows:

- The project uses FastAPI + DuckDB
- Timezone is Asia/Shanghai
- Database queries are handled in the Python layer

You don't need to explain it all again.

> ✨ **This is the value of memory**: it saves the 30 minutes you'd otherwise spend re-explaining every time.

## Best Practices

### ✅ What to Remember

- **Technical decisions**: Why you chose A over B
- **Pitfalls encountered**: The problem and the solution
- **Project conventions**: Naming conventions, directory structure, deployment method
- **Architecture knowledge**: Module relationships, data flow, key interfaces

### ❌ What Not to Remember

- Temporary debugging info ("this variable's value is 42")
- Outdated conclusions (remember to clean up periodically)
- General programming knowledge (the AI already knows how to write a for loop)

### Memory File Management

More memory isn't always better. The system has multi-layer protection:

| Threshold | Behavior |
|------|------|
| **20 files** | Prompt to watch the count |
| **25 files** | Warning: approaching limit, suggest cleanup/merge |
| **40 files** | **Hard rejection on writes** — must clean up first |

Cleanup methods:

1. **Merge**: Combine multiple files on the same topic into one
2. **Archive**: Outdated conclusions replaced by new ones — delete the old
3. **Split**: When a single file exceeds 200 lines, split by subtopic

Additionally, the memory system has **conflict detection** — if a new file has the same topic or overlaps on 3+ keywords with an existing memory, the write is **rejected outright**, forcing the conflict to be resolved first (merge or overwrite).

## Configuration

Install pi-memory via pi's `settings.json`:

```json
{
  "packages": [
    "pi-memory"
  ]
}
```

No additional configuration needed — ready to use on install. Memory files are stored in the project's `.pi/memory/` directory.

### Memory Scope

| Scope | Path | Usage |
|--------|------|------|
| Project-level | `.pi/memory/` | Project-specific knowledge (architecture, decisions, pitfalls) |
| Global | `~/.pi/agent/memory/` | Cross-project general knowledge (toolchain, coding discipline) |

## Advanced Scenarios: Memory Cleanup and Knowledge Evolution

### Scenario: Memory Fragmentation

After a month of use, memory files pile up:

```
.pi/memory/
├── database-choice--DuckDB,embedded,ARM.md
├── db-choice--database,DuckDB,performance.md       ← Duplicate of above!
├── deployment-issue--Docker,ARM,memory.md
├── deployment-issue2--Docker,memory,OOM.md         ← Also duplicate!
├── auth-bug--JWT,expiry,refresh.md
├── fastapi-cors--CORS,FastAPI,cross-origin.md
├── test-tricks--vitest,mock,testing.md
├── ... (20 more files)
```

Before each write, the AI automatically runs `memory_index` to check. If it finds existing memories on the same topic, it merges first before writing. But if fragmentation has already happened, manual cleanup is needed.

**Cleanup steps**:

1. Ask the AI to run `memory_index` to view all current memories
2. Mark files on the same topic (3+ overlapping keywords)
3. Ask the AI to read the marked files and merge them into one
4. Use `memory_update` to **overwrite an existing filename** (not a new one, or conflict detection will reject the write)
5. Delete the old fragmented files

### Scenario: Old Conclusions Overturned

A memory written last month says "use Express.js for the backend," but this month the project decided to migrate to FastAPI. Every time the AI reads the old memory, it thinks in Express terms and gives bad suggestions.

**Solution**: Use `memory_update` to overwrite the old file with the new conclusion:

```markdown
# Backend Framework Decision

Keywords: `FastAPI` `Python` `migration`

## Current Decision

2026-05: Migrated from Express.js to FastAPI.

## Migration Reasons

- Needed better async support
- Python's data analysis ecosystem is richer
- Express.js version has been archived and is no longer updated

> ⚠️ Old conclusion (deprecated): Use Express.js + TypeScript
```

**Key point**: Don't just delete the old file — clearly document both the new conclusion and how it relates to the old one, so the AI doesn't "reinvent" the old approach in other contexts.

### Scenario: Cross-Project Knowledge Reuse

You hit a pitfall in project A and want to make sure project B doesn't repeat the same mistake.

**Solution**: Write the general knowledge to global memory:

```
~/.pi/agent/memory/
└── npm-file-ref-traps--npm,file-ref,node_modules,cache.md
```

Global memory is visible to all projects. This way, no matter which project you're in, the AI will know "npm `file:` references have cache traps."

**Principle**:
- **Project-specific** knowledge (this project's architecture, conventions) → project-level `.pi/memory/`
- **General experience** (toolchain pitfalls, coding discipline) → global `~/.pi/agent/memory/`

## Next Steps

Now the AI has memory and can retain knowledge across sessions. But when faced with a large project, does it know what to do first, and what to do next?

In the next chapter, we'll look at how to teach the AI **planning**.
