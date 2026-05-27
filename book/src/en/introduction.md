<div class="hero">

# pi-atelier: Making AI Coding Assistants Professional

<div class="subtitle">Learn how to use the pi-atelier extension ecosystem to evolve your AI coding assistant from "can write code" to "can manage projects"</div>

</div>

## Who Is This Book For?

This book is for you if you're doing any of the following:

- Writing code with AI coding assistants (pi, Cursor, Copilot, etc.)
- Feeling like your AI assistant is "almost" good enough
- Wanting to evolve AI from a "Q&A tool" into a "project partner"

## What Is pi-atelier?

pi-atelier is a set of **pi extensions** that give AI coding assistants project management capabilities.

A regular AI assistant can write code, but:

- It forgets everything between sessions
- It tends to go off-track on large tasks
- It has no rules, making silly mistakes easily
- It gets dumber as the conversation grows longer

pi-atelier extensions fill these gaps:

<div class="feature-grid">

<div class="feature-card">

### 🧠 Memory
Let AI retain knowledge across sessions

</div>

<div class="feature-card">

### 📋 Planning
Manage three-tier roadmaps: Epic → Story → Task

</div>

<div class="feature-card">

### 🛡️ Shepherd
Set rules for AI to prevent mistakes

</div>

<div class="feature-card">

### 🔍 Diagnostics
Control context quality + token consumption analysis

</div>

<div class="feature-card">

### 📊 Analysis
Search and revisit historical sessions

</div>

<div class="feature-card">

### 🗜️ Compression
Keep AI sharp in long sessions

</div>

</div>

For a detailed comparison, see the table below:

| Capability | Extension | One-Line Description |
|------|------|-----------|
| Memory | pi-memory | Let AI retain knowledge across sessions |
| Planning | pi-roadmap | Let AI manage Epic → Story → Task |
| Shepherd | pi-shepherd | Set rules for AI to prevent mistakes |
| Context & Diagnostics | pi-context-manager | Control what AI sees + token consumption diagnostics |
| Journal | pi-journal | Generate log reports (git activity + session events + memory changes) |
| Analysis | pi-session-analyzer | Search and revisit historical sessions |
| Compression | pi-smart-compact | Keep AI smart in long sessions |
| Scheduling | pi-scheduler | Timed reminders and recurring tasks |
| Workflow | pi-workflow | Sub-agent orchestration, parallel execution |
| Tool Library | pi-shared-utils | Common utility functions for extension development |

## Reading Path

### Quick Start Path (1 hour)

1. Chapter 1: An AI's Memory → Install pi-memory in 5 minutes
2. Chapter 2: From Memory to Planning → Learn to manage tasks with roadmaps
3. Chapter 7: Build Your Own Extension → Understand the extension mechanism

### Comprehensive Path (3 hours)

Read all chapters in order. Each chapter includes:
- **Pain Point**: Real problems you will definitely encounter
- **How It Works**: How the extension works internally
- **Use Cases**: Real-world scenarios
- **Best Practices**: How to use it better

### On-Demand Reference

When facing a specific problem, jump directly to the relevant chapter. Each chapter is self-contained.

## Quick Install

Add the extensions you need to pi's `settings.json`:

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

Or install everything (pi-workflow and pi-shared-utils are development libraries; regular users don't need to install them directly):

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-shepherd",
    "pi-context-manager",
    "pi-session-analyzer",
    "pi-smart-compact",
    "pi-scheduler",
    "pi-workflow",
    "pi-shared-utils"
  ]
}
```

Most extensions are **ready to use out of the box** — no additional configuration needed after installation (though you can customize as needed).

> 💡 **Tip**: pi-workflow and pi-shared-utils are development libraries used by other extensions; regular users generally don't need to install them directly.

## Important File Paths

Before you start, here are the key pi files you need to know:

| File | Path | Description |
|------|------|------|
| Global Config | `~/.pi/agent/settings.json` | Install extensions, configure providers |
| Project Config | `.pi/settings.json` (project root) | Project-level custom configuration (overrides global) |
| Project Instructions | `AGENTS.md` (project root or `.pi/agent/`) | Project rules injected into the AI |
| Extension Install Dir | `~/.pi/agent/npm/node_modules/` | npm package installation location |
| Memory Directory | `.pi/memory/` (project-level) | Project-level persistent memory |
| Global Memory | `~/.pi/agent/memory/` | Cross-project general memory |

> 💡 **Newcomer Tip**: `~` refers to your home directory. On macOS/Linux it's `/home/your-username/`, on Windows it's `C:\Users\your-username\`.

## Conventions

Examples in this book follow these conventions:

- `Code blocks`: Commands, file paths, code snippets
- **Bold**: Important concepts
- > 💡 Tip: Practical tips and notes
- Tables: Quick comparisons and reference

Ready to get started? Flip to Chapter 1, and let's begin with "memory."
