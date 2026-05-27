# 6.3 pi-workflow: Sub-agent Orchestration

> pi-workflow is the "task dispatcher" of pi-atelier — it lets the AI break complex tasks into multiple sub-agents that execute in parallel, then synthesizes the results.

## Why Sub-agents?

A single AI session has a limited context window. When a task requires:
- **Searching multiple information sources simultaneously**
- **Executing independent operations without interference**
- **Reviewing the same code from different perspectives**

A single AI can only process sequentially, which is inefficient, and all the information gets crammed into one context.

Sub-agents solve this — each sub-agent has its own independent context window, and only returns the final result to the main agent.

## How It Works

```
Main agent
  │ "Research performance differences between Bun and Node.js"
  │
  ├──→ Sub-agent 1 (Search Expert)
  │     Independent context window
  │     Search online resources
  │     Return key data points
  │
  ├──→ Sub-agent 2 (Source Expert)
  │     Independent context window
  │     Search GitHub repository
  │     Return benchmark data
  │
  └──→ Sub-agent 3 (History Expert)
        Independent context window
        Search historical sessions
        Return previous discussion records
  │
  ▼
Main agent synthesizes three results → Output final recommendation
```

### Sub-agent Characteristics

| Feature | Description |
|---------|-------------|
| Independent context | Each sub-agent has its own context window, won't pollute the main session |
| Independent tool set | Can restrict which tools each sub-agent can use |
| Error isolation | One sub-agent failing doesn't affect others |
| Token efficiency | Only final results return to the main context, intermediate steps don't occupy the main window |

## Available Sub-agents

Sub-agents are defined in `~/.pi/agent/agents/*.md` — each `.md` file defines a sub-agent's role and tool set:

| Sub-agent | Purpose | Tools |
|-----------|---------|-------|
| `pv-explorer` | Code exploration — analyze architecture, call chains, design patterns | read, grep, find, ls |
| `pv-reviewer` | Independent plan review — check architecture violations, dependency direction errors | read, grep, find, ls |
| `pv-executor` | Execute code changes — implement according to plan, make tests pass | All tools |
| `pv-simplifier` | Code simplification — identify duplication, inefficient patterns | read, grep, find, ls |
| `fo-analyzer` | Factor analysis — run analysis scripts + parse results | bash, read |
| `fo-verifier` | Factor verification — run final backtest + output report | bash, read |
| `fr-searcher` | Factor search — search literature and source code | read, grep, find, ls |
| `fr-writer` | Factor writing — synthesize research findings | read, grep, find, ls |
| `security-auditor` | Security audit — check for security vulnerabilities | read, grep, find, ls |

## Use Cases

### Scenario 1: Plan Review (Plan-Verify Flow)

Before making complex changes, use `pv-reviewer` to independently review the plan:

```
Main agent: I've designed a refactoring plan, let the reviewer check it.
  │
  └──→ pv-reviewer
        "Review the following plan: Switch the auth module from JWT to session-based"

        Review result:
        ✅ Dependency direction is correct
        ⚠️ Violates data model invariant #3 (user session should be immutable)
        ❌ Missing test coverage — new session storage needs integration tests
```

**Value**: The reviewer looks at the plan from an independent perspective and can catch issues that the main agent "can't see from inside."

### Scenario 2: Code Exploration

Use `pv-explorer` for structured code analysis without polluting the main context:

```
Main agent: I need to understand the architecture of this module.
  │
  └──→ pv-explorer
        "Analyze the architecture, call chains, and design patterns of src/auth/"

        Returns:
        - Module structure diagram
        - Core function call chains
        - Design patterns used (middleware chain, strategy pattern)
        - Dependency direction
```

**Value**: The exploration process may read dozens of files — if all of them were in the main context, they'd fill it up. The sub-agent only returns the essence.

### Scenario 3: Security Audit

Use `security-auditor` to check code for security vulnerabilities:

```
Main agent: This code handles user input, help me do a security audit.
  │
  └──→ security-auditor
        "Audit input validation and injection risks in src/api/handlers/"

        Findings:
        ⚠️ SQL injection risk: query parameters directly concatenated into SQL
        ⚠️ XSS risk: user input returned as HTML without escaping
        ✅ Auth checks: all endpoints have auth middleware
```

## Sub-agents vs Normal Chat

| Dimension | Normal Chat | Sub-agent |
|-----------|-------------|-----------|
| Context | All information in one window | Each sub-agent has its own window |
| Parallelism | Sequential processing | Can be parallel |
| Error impact | Global impact | Isolated |
| Token consumption | Intermediate steps all occupy main window | Only results occupy main window |
| Best for | Simple tasks, Q&A | Complex research, multi-party review |

> 💡 **Rule of thumb**: If a task requires reading many files but ultimately needs just one conclusion, use sub-agents. If it requires multi-turn interactive discussion, use normal chat.

## Notes

- Sub-agents are **one-shot** — they return results and terminate, they don't maintain state
- Sub-agents have **restricted tool sets** — `pv-explorer` only has read-only tools and cannot modify files
- Sub-agents **cannot see the full context of the main session** — they only see the `task` description you pass to them
- Therefore, the task description passed to a sub-agent must be **sufficiently detailed** — include all necessary background information

## Next Steps

> 📖 Return to [6.1 Automation & Workflows](./automation.md) for complete usage examples.
