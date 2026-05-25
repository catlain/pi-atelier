# Data Model and Invariants

Status: current
Evidence: observed
Last validated: 2025-05-22

## Key Data Structures

### 1. Memory Files

**Format**: `topic--kw1,kw2,kw3.md` (filename encodes metadata)

```typescript
interface MemoryEntry {
  name: string;       // filename without .md
  file: string;       // full filename
  description: string; // first # heading
  lines: number;
  scope: "L1" | "L2"; // L1=global, L2=project
  topic: string;      // parsed from filename
  keywords: string[]; // parsed from filename
}
```

**Invariants**:
- Max 5 keywords per file
- Max 80 lines per file
- MEMORY.md is an index file, never a memory entry
- File content must start with `# Title` line
- Second line should be `关键词：kw1 kw2 ...`

### 2. Shepherd Rules

**Storage**: `extensions/shepherd/rules.json` — array of 31 rule objects

```typescript
interface ShepherdRule {
  comment: string;
  tool: string;        // glob pattern for tool name
  action: "rewrite" | "block" | "notify" | "steer";
  pattern: string;     // regex for args matching
  flags: string;       // regex flags
  reason: string;      // human-readable reason
  enabled: boolean;
}
```

**Invariants**:
- Each rule has exactly one action
- `pattern` is a regex string (compiled at runtime)
- Rules are evaluated in array order; first match wins

### 3. Plan-Verify State

```typescript
type Phase = "idle" | "planning" | "verifying" | "fixing" | "review-decision" |
             "writing-tests" | "test-review-decision" | "executing" |
             "fixing-tests" | "simplifying";

interface PlanVerifyState {
  phase: Phase;
  planFile?: string;
  planContent?: string;
  issues: Issue[];
  round: number;
  maxRounds: number;
  task?: string;
  subSessionId?: string;
  sessionId?: string;
  testFiles?: string[];
}
```

**Invariants**:
- Phase transitions follow strict state machine (10 phases)
- State persisted per-session via `createStateManager()`
- `round` tracks plan-review iterations (max: `maxRounds`)

### 4. Tool Result Processor (Context)

```typescript
interface ToolResultEvent {
  toolName: string;
  args: any;
  result: string;
}

interface ProcessorOptions {
  threshold: number;    // token threshold for truncation
  previewLines: number; // lines to keep in preview
}

interface DistillEntry {
  tmpPath?: string;
  originalTokens: number;
  toolName: string;
  origLength: number;
  argsSignature?: string;
}
```

**Invariants**:
- Formatter chain order: [webSearch → gh → webRead → bash → mcpError]
- First matching formatter wins (must return !== input to indicate success)
- `unwrapDoubleEncodedJson` runs before formatter chain
- Fallback: return original text if no formatter matches

### 5. Scheduler Timer

```typescript
interface Timer {
  id: string;
  prompt: string;
  intervalMs: number;
  createdAt: number;
  expiresAt: number;
  recurring: boolean;
  firedCount: number;
  status: "active" | "completed" | "cancelled" | "error";
}
```

**Invariants**:
- Non-recurring timers fire once then set status="completed"
- Recurring timers increment firedCount and reset expiresAt
- State persisted in memory only (lost on session end)

### 6. Context Panel UI

```typescript
interface ContextData {
  categories: CategoryItem[];
  totalActual: number;
  limit: number;
  percent: number;
}
```

**Invariants**:
- categories group tool results by type (read, bash, grep, etc.)
- totalActual = sum of all detail values (token counts)
- percent = totalActual / limit * 100

### 7. Subagent Result

```typescript
interface SubagentResult {
  exitCode: number;
  output: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
  subSessionId?: string;
}
```

**Invariants**:
- exitCode 0 = success, non-zero = failure
- output is stdout of child pi process
- subSessionId links to child session's JSONL file

### 8. Roadmap Plan

```typescript
type RoadmapStatus = 'active' | 'paused' | 'completed' | 'archived';
type ItemStatus = 'todo' | 'doing' | 'done' | 'blocked' | 'dropped';
type Priority = 'low' | 'medium' | 'high';

interface RoadmapFile {
  meta: RoadmapMeta;
  epics: Epic[];
}

interface RoadmapMeta {
  id: string;           // slug: "pi-atelier-split"
  title: string;
  status: RoadmapStatus;
  created: string;      // ISO date
  updated: string;
  tags: string[];
}

interface Epic {
  id: string;           // "E1"
  title: string;
  description: string;
  status: ItemStatus;
  priority: Priority;
  stories: Story[];
}

interface Story {
  id: string;           // "E1.S1"
  title: string;
  description: string;
  status: ItemStatus;
  project?: string;     // associated project path
  tasks: Task[];
}

interface Task {
  id: string;           // "E1.S1.T1"
  title: string;
  status: ItemStatus;
  assignee?: string;
  doneDate?: string;
  note?: string;
}
```

**Invariants**:
- INV-R1: Roadmap files must be valid JSON; invalid files are repaired or rejected
- INV-R2: IDs are unique: epic id globally unique, story id unique within epic, task id unique within story
- INV-R3: Status transitions: todo → doing → done / blocked / dropped
- INV-R4: Task is the leaf node — no nesting below Task
- INV-R5: Project-level roadmap (`<project>/.pi/roadmap/roadmap.json`) is derived from global, cannot be created independently
- INV-R6: Archived roadmaps are not injected and excluded from default `roadmap_list`

## Cross-Cutting Invariants

### INV-1: Settings Persistence
All persistent config lives in `~/.pi/agent/settings.json`, accessed via `getSettingsSection`/`patchSettingsSection`. Never direct file I/O for settings.

### INV-2: Ephemeral Hints Protocol
Cross-extension communication via `pi.events.emit("ephemeral:hint", {text, short})`. Only context emits; only shepherd consumes.

### INV-3: Session File Location
Session files at `~/.pi/agent/sessions/<id>.jsonl`. Read-only for all extensions except pi itself.

### INV-4: Temp File Isolation
All temp files under `/tmp/pi-distill/`. Never pollute project directories with temp data.

### INV-5: Extension Isolation
Extensions never import from other extensions. Communication only via:
- `pi.events` (event bus)
- Shared libraries (`lib/*`)
- Settings file (indirect)

### INV-6: Formatter Fallback
Tool result formatters always return a string. If no formatter matches, return original text unchanged. Formatters are pure functions: `(text: string) => string`.

## Data Persistence Map

| Data | Location | Format | Lifecycle |
|------|----------|--------|-----------|
| Settings | `~/.pi/agent/settings.json` | JSON | Persistent, survives restart |
| Memory files | `~/.pi/agent/memory/*.md`, `<project>/.pi/memory/*.md` | Markdown | Persistent, manual cleanup |
| Distill manifest | `/tmp/pi-distill/manifest.json` | JSON | Session-scoped, survives restart within OS |
| Last context messages | `/tmp/pi-distill/last-messages.json` | JSON | Session-scoped |
| Last provider payload | `/tmp/pi-distill/last-payload.json` | JSON | Session-scoped |
| Session JSONL | `~/.pi/agent/sessions/<id>.jsonl` | JSONL | Persistent, pi manages lifecycle |
| Roadmap (global) | `~/.pi/roadmap/*.roadmap.json` | JSON | Persistent, managed by roadmap extension |
| Roadmap (project) | `<project>/.pi/roadmap/roadmap.json` | JSON | Derived from global, syncs on read/write |
| Roadmap (archive) | `~/.pi/roadmap/archive/*.roadmap.json` | JSON | Completed/archived roadmaps |
| Recordings | `/tmp/pi-distill/recordings/` | JSON | Session-scoped, opt-in |
