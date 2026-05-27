# From Memory to Planning

## You've Probably Encountered This

You ask an AI to do a large task like "migrate the project from JavaScript to TypeScript."

Everything goes well for the first 30 minutes — the AI migrates configuration files, type definitions, and core modules as planned. But by the 5th file, the AI starts to "drift":

- It forgets earlier conventions and starts using a different naming style
- It skips migrating test files
- It begins a "refactor while you're at it" that you never asked for
- When you remind it to get back on track, it can't remember what the first 3 steps of the original plan were

> 💡 **Goldfish memory is solved, but there's still an "attention deficit" problem**: The AI can remember knowledge, but it can't manage tasks.

## Roadmap: Teaching AI to Manage Complex Tasks

pi-roadmap gives the AI a "project management brain":

- **Structured breakdown**: Decomposes large goals into Epic → Story → Task three layers
- **Progress tracking**: Each task has a clear status (todo / doing / done / blocked)
- **Persistence**: Roadmaps are saved in files, so new sessions can continue where you left off
- **Priority sorting**: Automatically recommends what to do next

### Why a Three-Layer Structure?

```
Epic (Big direction)
 └── Story (Deliverable work chunk)
      └── Task (Smallest executable unit)
```

This structure comes from agile development practices, with some adaptations:

| Concept | Traditional Agile | pi-roadmap | Rationale |
|---------|------------------|------------|-----------|
| Epic | 2-8 weeks | A complete project direction | AI sessions don't span weeks |
| Story | 1-3 days | Completable in 1-3 sessions | Adapted to AI's working rhythm |
| Task | 0.5-1 day | 30 min - 2 hours | Granularity AI can focus on at once |

### How It Works

```
User describes goal
     │
     ▼
┌──────────────────────────────────┐
│         roadmap_plan             │
│  AI analyzes goal → breaks into  │
│  three-layer structure           │
│  compares with existing roadmap  │
│  → incremental update            │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  ~/.pi/roadmap/<id>.roadmap.json │
│  Global storage, cross-session   │
│  and cross-project access        │
│  + Project-level                 │
│    .pi/roadmap/roadmap.json      │
│    (auto-synced derivation)      │
└──────────────┬───────────────────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
 roadmap_list  roadmap_show  roadmap_next
  List all     Show detail   Recommend next
```

## Real-World Example: Migrating a Multi-Package Project

Let's look at a real scenario — upgrading documentation across 12 npm packages simultaneously:

### Step 1: Create a Roadmap

You say: "Help me plan documentation work for all packages."

The AI calls `roadmap_plan`, which automatically decomposes:

```json
{
  "roadmapId": "package-docs",
  "title": "Package Documentation Upgrade",
  "epics": [
    {
      "id": "E0",
      "title": "Define template and validate",
      "stories": [
        {
          "id": "E0.S0",
          "title": "Analyze best practices, distill template",
          "tasks": [
            { "id": "E0.S0.T0", "title": "Research GitHub documentation standards" },
            { "id": "E0.S0.T1", "title": "Distill README template" },
            { "id": "E0.S0.T2", "title": "Validate template with first package" }
          ]
        }
      ]
    },
    {
      "id": "E1",
      "title": "Batch upgrade all packages",
      "stories": [
        { "id": "E1.S0", "title": "Core extensions (4 packages)" },
        { "id": "E1.S1", "title": "Tool extensions (4 packages)" },
        { "id": "E1.S2", "title": "Utility extensions (4 packages)" }
      ]
    }
  ]
}
```

### Step 2: Advance According to Plan

In each new session, you say "continue." The AI calls `roadmap_next`:

```
📊 Recommended next task:

E0.S0.T1 — Distill README template (high priority)
  Part of: E0 Define template and validate > S0 Analyze best practices

Start?
```

### Step 3: Mark Completion

After completing a task, the AI calls `roadmap_done`:

```
✅ E0.S0.T1 Completed
    Output: templates/README-template.md
```

### Step 4: Encountering Blockers

If source code for a package is missing, the AI can mark the task as blocked:

```
⚠️ E1.S1.T3 Blocked
    Reason: pi-journal's API documentation is incomplete; source code comments need to be added first
```

## Roadmap vs Memory: What's the Relationship?

| Dimension | Memory (pi-memory) | Roadmap (pi-roadmap) |
|-----------|-------------------|----------------------|
| What it stores | Knowledge, decisions, pitfalls | Tasks, progress, plans |
| Granularity | Free-form text | Structured JSON |
| Query method | Keywords | Status / priority |
| Lifecycle | Long-term retention | Can be archived when project ends |

Simply put:

- **Memory** is "what I know"
- **Roadmap** is "what I need to do and how far along I am"

The two complement each other: memory helps the AI remember knowledge, the roadmap helps the AI remember tasks.

## Best Practices

### ✅ Good Epic Breakdown

```
Epic: Publish npm package
  Story: Prepare release environment
    Task: Configure package.json exports field
    Task: Add bundledDependencies configuration
    Task: Configure tsconfig declaration output
  Story: Write documentation
    Task: Complete README.md
    Task: Add CHANGELOG.md
```

### ❌ Bad Breakdown

```
Epic: Do everything                     ← Too vague, no direction
  Story: Do the first step              ← Doesn't say what to do
    Task: Start working                  ← Not actionable
```

### Golden Rules of Breakdown

1. **Epic titles should be verb phrases**: "Publish npm package" instead of "npm"
2. **Stories should have clear deliverables**: "Complete README" instead of "Write docs"
3. **Tasks should be executable within 30 minutes**: "Configure package.json name field" instead of "Configure build"
4. **Items at the same level should have the same granularity**: Don't have one Story with 2 tasks and another with 20

## Advanced Scenarios: Plan Adjustment & Progress Tracking

### Scenario: When Direction Needs to Change

Plans change. The roadmap you laid out yesterday may no longer fit today's requirements. You don't need to start over — just update with `roadmap_plan`:

```
You: Yesterday's refactoring plan is too big. I want to start with just the auth module.

AI calls roadmap_plan(action="update"):
  → Compares current roadmap with your new requirements
  → Keeps completed tasks untouched
  → Marks unnecessary tasks as dropped
  → Adds new tasks
```

**Key principle**: `roadmap_plan` is incremental, not overwriting. Tasks already marked `done` are never rolled back.

### Scenario: Tracking Who Did What

In multi-session collaboration, you often wonder "which session completed this task?" The roadmap tracks this automatically:

```
roadmap_show(roadmapId="package-docs")

Result:
  E0.S0.T0 Research GitHub documentation standards ✅ by: 8740-8fce3e7af232
  E0.S0.T1 Distill README template ✅ by: b8b5-85516ead6253
  E0.S0.T2 Validate template with first package ✅ by: b8b5-85516ead6253
  E1.S0.T0 Core extension - pi-shepherd 🔄 doing by: aa55-a4860e851afb
```

The `by: xxxx-xxxxxxxxxxxx` suffix after each completed task is the short form of the session ID (last two segments of the UUID). You can use this ID to search for the specific session:

```
session_search(action="grep", query="8740-8fce3e7af232")

→ Find the session, then use session_analyze(action="summary") to view details
```

### Scenario: Archiving Completed Epics

When a project is finished, you don't want completed Epics cluttering your view:

```
roadmap_archive(roadmapId="package-docs")

→ Auto-archives all completed Epics
→ Hidden by default, view with show_archived=true
```

### Scenario: Not Sure What to Do Next

When you open pi and have no idea what to continue:

```
roadmap_next()

Result:
  📊 Recommended next task (sorted by priority):
  
  1. E1.S0.T3 — Configure package.json files whitelist (high, todo)
  2. E1.S1.T0 — Tool extension - pi-roadmap (medium, todo)
  3. E2.S0.T0 — Research mdBook theme customization (low, todo)
```

`roadmap_next` automatically sorts by doing → todo, high → medium → low, telling you exactly what deserves your attention.

## Next Steps

The AI now has memory (to remember knowledge) and a roadmap (to manage tasks). But sometimes, the AI still "makes mistakes" — modifying files it shouldn't, using approaches it shouldn't.

In the next chapter, we'll look at how to **set rules** for the AI.
