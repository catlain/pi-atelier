# An AI's Memory

## You've Probably Experienced This

You're developing a project with an AI coding assistant. On the first day, you spent half an hour explaining to the AI:

- The project uses Rust + Axum tech stack
- The database is DuckDB, not PostgreSQL
- The auth module uses JWT, not Session
- The deployment target is an ARM-based embedded device

The AI understood and wrote perfect code.

Next day, you open a new session, and the AI has forgotten everything. It starts suggesting Express.js, connecting to PostgreSQL, using Session auth again…

> 💡 **This is the AI's "goldfish memory" problem**: every new session is a blank slate.

## Memory: Giving AI Cross-Session Knowledge

pi-memory is designed to solve this. It gives the AI a "notebook":

- **Auto-record**: Architecture decisions, pitfalls encountered, and consensus reached during the session are automatically captured
- **Auto-load**: At the start of each new session, the AI automatically reads previously stored key knowledge
- **Per-project isolation**: Memories from different projects don't interfere with each other

### How It Works

```
┌─────────────────────────────────────────┐
│            AI Session                    │
│                                          │
│  ┌──────────┐     ┌──────────────────┐  │
│  │ Chat with │ ──→ │ AI auto-extracts │  │
│  │  User    │     │   knowledge pts   │  │
│  └──────────┘     └────────┬─────────┘  │
│                            │             │
│                            ▼             │
│                   ┌─────────────────┐    │
│                   │  memory_update  │    │
│                   │  writes memory  │    │
│                   │    file         │    │
│                   └─────────────────┘    │
│                                          │
│  ┌──────────┐     ┌──────────────────┐  │
│  │ New      │ ──→ │ before_agent_start│  │
│  │ session  │     │ auto-loads index │  │
│  └──────────┘     └──────────────────┘  │
└─────────────────────────────────────────┘
```

Core memory structure:

| Component | Role |
|------|------|
| `MEMORY.md` | Index file listing all memory titles and keywords |
| Memory files (`.md`) | One file per topic, containing specific knowledge |
| `memory_update` tool | Used by the AI to write/update memories |
| `memory_index` tool | Used by the AI to browse existing memories |

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

File naming pattern: `topic--keyword1,keyword2,keyword3.md`

Example: `database-choice--DuckDB,embedded,ARM,column-store,analytical-queries.md`

## Real-World Example: The First Week of a New Project

Let's look at a real scenario. Suppose you're building a data analysis tool:

### Day 1: Project Initialization

You and the AI discussed technology choices and decided on Python + FastAPI + DuckDB. At the end of the session, the AI automatically wrote a memory:

```markdown
# Tech Stack Decision

Keywords: `Python` `FastAPI` `DuckDB` `technology-choice`

## Rationale

- FastAPI: excellent async support, auto-generated API docs
- DuckDB: embedded analytical database, no separate deployment needed, suitable for local analysis
  - Not choosing PostgreSQL: project doesn't need concurrent writes, embedded is simpler
- Python 3.12+: using new type syntax
```

### Day 3: Hit a Pitfall

You ran into an issue with DuckDB's date handling — the default timezone is UTC, but your users are in China. After the AI helped you solve it, it wrote a memory:

```markdown
# DuckDB Timezone Issue

Keywords: `DuckDB` `timezone` `date` `UTC` `Asia/Shanghai`

## Problem and Solution

DuckDB uses UTC timezone by default. Querying `SELECT NOW()` returns UTC time.

Solution: Set `SET timezone = 'Asia/Shanghai'` at connection time.

Note: Don't do timezone conversion at the SQL level; handle it in Python with datetime for more reliability.
```

### Day 7: New Session, No Need to Re-explain

You open a new session and say "add a CSV export feature to the analysis API." The AI already knows:

- The project uses FastAPI + DuckDB
- Timezone is set to Asia/Shanghai
- Database queries are handled in the Python layer

You don't need to explain any of this again.

> ✨ **This is the value of memory**: it saves the 30 minutes of repeated explanation every time.

## Best Practices

### ✅ What to Remember

- **Technical decisions**: why A was chosen over B
- **Pitfalls encountered**: problems and their solutions
- **Project conventions**: naming conventions, directory structure, deployment methods
- **Architecture knowledge**: module relationships, data flow, key interfaces

### ❌ What Not to Remember

- Temporary debug info ("this variable's value is 42")
- Already outdated conclusions (remember to clean up periodically)
- General programming knowledge (the AI already knows how to write for loops)

### Managing Memory Files

More memory isn't always better. When the file count exceeds **25**, it's time to clean up:

1. **Merge**: multiple files on the same topic into one
2. **Archive**: outdated conclusions replaced by newer ones, delete the old
3. **Split**: when a single file exceeds 200 lines, split by sub-topic

The memory system automatically checks the count when the AI attempts to write. When it exceeds **40**, writes are rejected and cleanup is forced.

## Configuration

pi-memory is installed via pi's `settings.json`:

```json
{
  "packages": [
    "pi-memory"
  ]
}
```

No additional configuration needed — install and use. Memory files are stored in the project's `.pi/memory/` directory.

### Memory Scopes

| Scope | Path | Purpose |
|--------|------|---------|
| Project-level | `.pi/memory/` | Project-specific knowledge (architecture, decisions, pitfalls) |
| Global | `~/.pi/agent/memory/` | Cross-project shared knowledge (toolchain, coding discipline) |

## Next Steps

Now the AI has memory and can remember past knowledge. But when facing a large project, does it know what to do first, and what to do next?

In the next chapter, we'll look at how to teach the AI **planning**.
