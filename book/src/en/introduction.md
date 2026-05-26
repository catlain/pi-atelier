# pi-atelier: Making AI Coding Assistants Professional

## Who Is This Book For?

This book is for you if you're doing any of the following:

- Using AI coding assistants (such as pi, Cursor, Copilot) to write code
- Feeling that your AI assistant is "almost" good enough to do better
- Wanting to evolve AI from a "Q&A tool" into a "project partner"

## What Is pi-atelier?

pi-atelier is a set of **pi extensions** that equip AI coding assistants with project management capabilities.

A typical AI assistant can write code, but:

- It forgets everything from previous sessions
- It easily goes off-track on large tasks
- It lacks discipline and makes elementary mistakes
- It gets dumber as sessions grow longer

pi-atelier's extensions fill these capability gaps:

| Capability | Extension | One-Liner Description |
|------|------|-----------|
| Memory | pi-memory | Lets the AI remember knowledge across sessions |
| Planning | pi-roadmap | Lets the AI manage Epic → Story → Task |
| Guardrails | pi-shepherd | Sets rules for the AI to prevent mistakes |
| Context & Diagnostics | pi-context-manager | Controls information quality + token consumption diagnostics |
| Journaling | pi-journal | Automatically records what happened in each session |
| Analysis | pi-session-analyzer | Search and review historical sessions |
| Compression | pi-smart-compact | Keeps the AI sharp during long sessions |
| Scheduling | pi-scheduler | Timed reminders and recurring tasks |
| Workflow | pi-workflow | Sub-agent orchestration, parallel execution |
| Utilities | pi-shared-utils | Common utility functions for extension development |

## Reading Tracks

### Quick Start Track (1 hour)

1. Chapter 1: An AI's Memory → Install pi-memory in 5 minutes
2. Chapter 2: From Memory to Planning → Learn to manage tasks with a roadmap
3. Chapter 7: Building Your Own Extension → Understand the extension mechanism

### Deep Dive Track (3 hours)

Read all chapters in order. Each chapter contains:

- **Pain Points**: Real problems you will definitely encounter
- **How It Works**: How the extension works under the hood
- **Case Studies**: Real-world usage scenarios
- **Best Practices**: How to get the most out of it

### Reference Track

Jump directly to the relevant chapter when you encounter a specific problem. Each chapter is self-contained.

## Quick Install

Add the extensions you need to pi's `settings.json`:

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

Or install everything:

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
    "pi-workflow",
    "pi-shared-utils"
  ]
}
```

All extensions are **ready-to-use** — no additional configuration required after installation (but you can customize as needed).

## Important File Paths

Before you begin, here are the key pi file locations you should know:

| File | Path | Description |
|------|------|-------------|
| Global config | `~/.pi/settings.json` | Install extensions, configure providers |
| Project config | `.pi/config.json` (project root) | Project-level custom configuration |
| Project instructions | `.pi/agent/AGENTS.md` (project root) | Project rules injected into the AI |
| Extension install dir | `~/.pi/agent/npm/node_modules/` | npm package installation location |
| Memory directory | `.pi/memory/` (project-level) | Project-level persistent memory |
| Global memory | `~/.pi/agent/memory/` | Cross-project shared memory |

> 💡 **Newcomer Tip**: `~` refers to your home directory. On macOS/Linux it's `/home/your-username/`, on Windows it's `C:\Users\your-username\`.

## Conventions

Examples in this book use the following conventions:

- `Code blocks`: Commands, file paths, code snippets
- **Bold**: Important concepts
- > 💡 Tip: Practical advice and notes
- Tables: Quick comparisons and references

Ready to get started? Turn to Chapter 1, and let's begin with "Memory."
