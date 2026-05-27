# Write Your Own Extensions

## Why Write Your Own Extension?

pi-atelier provides 10 extensions covering core scenarios like memory, planning, rules, retrospective, compression, and automation. But every project has its own special needs:

- Your team uses Feishu instead of Slack, so you need a Feishu notification extension
- You're doing game development and need an extension to automatically manage the assets directory
- You're writing academic papers and need an extension for LaTeX compilation + citation checking

> 💡 **At its core, an extension is about giving AI new tools and new knowledge.**

## Extension Architecture

### What Makes Up an Extension?

```
pi-xxx/
├── package.json        # Package metadata + pi extension configuration
├── index.ts            # Entry point, registers tools and hooks
├── lib/                # Tool implementations
│   └── tools-xxx.ts
├── prompts/            # Prompt templates (descriptions visible to AI)
│   └── xxx-description.md
└── README.md           # Documentation
```

### Core Concepts

| Concept | Description | Analogy |
|---------|-------------|---------|
| **Tool** | A function AI can call | Giving AI a new hammer |
| **Hook** | Logic executed at specific moments | Giving AI an alarm clock |
| **Prompt** | Description of the tool (what AI sees) | Telling AI how to use this hammer |
| **Config** | User-configurable parameters | The hammer's force adjustment |

### Extension Lifecycle

```
1. pi starts
     │
     ▼
2. Load packages from settings.json
     │
     ▼
3. Install/update extensions (npm or git)
     │
     ▼
4. Execute extension entry function `export default function(pi)`
     │
     ├── Register tools (pi.registerTool)
     ├── Register commands (pi.registerCommand)
     └── Listen to events (pi.on)
     │
     ▼
5. AI session can now call the new tools
```

## Hands-On: Writing a "Code Stats" Extension from Scratch

Let's build a simple extension step by step — counting lines of code in a project.

### Step 1: Create the Project

```bash
mkdir pi-code-stats
cd pi-code-stats
npm init -y
```

Modify `package.json`:

```json
{
  "name": "pi-code-stats",
  "version": "0.1.0",
  "main": "index.ts",
  "piExtension": true
}
```

> 💡 `"piExtension": true` tells pi this is an extension package. `"main"` points to the entry file (TypeScript or JavaScript — both work; pi uses jiti to load them).

### Step 2: Write the Tool Implementation

`lib/tools-stats.ts`:

```typescript
import { execSync } from 'child_process';

export function countLines(directory: string, extension: string): {
  total: number;
  files: { path: string; lines: number }[];
} {
  const cmd = `find ${directory} -name "*.${extension}" -not -path "*/node_modules/*" -not -path "*/.git/*"`;
  const files = execSync(cmd).toString().trim().split('\n');
  
  const results = files.map(file => ({
    path: file,
    lines: Number(execSync(`wc -l < ${file}`).toString().trim())
  }));
  
  return {
    total: results.reduce((sum, r) => sum + r.lines, 0),
    files: results.sort((a, b) => b.lines - a.lines)
  };
}
```

### Step 3: Write the Entry File

`index.ts`:

```typescript
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { countLines } from './lib/tools-stats';

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: 'code_stats',
    label: 'Code Stats',
    description: 'Count lines of code in a project. Use when the user says "count code" or "how many lines of code".',
    promptSnippet: 'Count lines of code in a project.',
    parameters: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'The directory path to count'
        },
        extension: {
          type: 'string',
          description: 'File extension, e.g. ts, py, rs'
        }
      },
      required: ['directory']
    },
    async execute(_toolCallId: string, params: any): Promise<any> {
      const result = countLines(params.directory, params.extension || 'ts');
      return {
        totalLines: result.total,
        fileCount: result.files.length,
        topFiles: result.files.slice(0, 10)
      };
    }
  });
}
```

### Step 4: Write the Tool Description

`prompts/stats-description.md`:

```markdown
Count lines of code in a project.

Parameters:
- directory (required): The directory path to count
- extension (optional): File extension, defaults to ts

Returns:
- totalLines: Total line count
- fileCount: Number of files
- topFiles: Top 10 largest files

Example:
  code_stats(directory="src", extension="ts")
  → { totalLines: 12340, fileCount: 45, topFiles: [...] }
```

### Step 5: Install and Test

```json
// settings.json
{
  "packages": [
    "./path/to/pi-code-stats"
  ]
}
```

Restart pi, and the AI will be able to use the `code_stats` tool.

## pi-shared-utils: Your Toolbox

When writing extensions, you don't have to start from scratch every time. `pi-shared-utils` provides a set of common utility functions:

| Module | Function | When to Use |
|--------|----------|-------------|
| `logger` | Unified logging format | When you need to print debug info |
| `storage` | Cross-session persistent storage | When you need to save configuration or state |
| `paths` | Unified path handling | When you need to find file locations |
| `json` | Safe JSON read/write | When you need to manipulate JSON files |
| `validator` | Parameter validation | When you need to validate tool parameters |
| `settings-backup` | settings.json backup and rollback | When you need to safely write config |
| `file-lock` | File locks (proper-lockfile wrapper) | When you need to prevent race conditions |
| `config` | Three-layer config merging (defaults → global → project) | When your extension needs configurable parameters |

### Usage Example

```typescript
import { logger, storage, paths } from '@pi-atelier/shared-utils';

// Logging
logger.info('Extension activated');
logger.warn('Missing configuration file, using defaults');

// Paths
const projectRoot = paths.getProjectRoot();
const memoryDir = paths.getMemoryDir();
```

### Configuration API Example

If your extension needs user-configurable parameters:

```typescript
import { getEffectiveConfig } from '@pi-atelier/shared-utils';

const defaults = { threshold: 1000, enabled: true };
const config = getEffectiveConfig('my-extension', defaults, cwd);
// config = final configuration after three-layer merge
```

## Debugging Your Extension

Common issues during extension development: the tool is registered but AI doesn't call it, errors occur in the handler without visible logs, or the returned result isn't what was expected.

### Viewing Log Output

Output from `logger.info()` and `console.log()` in your extension appears in pi's **terminal window** (not the chat window). Debugging steps:

```bash
# Start pi in the terminal (not in the background) to see all log output
pi

# Then ask the AI to call your tool in the chat window
# The terminal will display the log output
```

### Confirming Tool Registration

In the pi chat, directly ask the AI:

```
What tools do you have available? Can you see code_stats?
```

If the AI can't see your tool, check:
- Does `package.json` have `"piExtension": true`?
- Is the package path in `settings.json` correct?
- Is the entry function exported correctly (`export default function(pi)`)?

### Common Issue Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| AI can't see the tool | Missing `piExtension` field | Add `"piExtension": true` to package.json |
| Tool call errors | Exception in handler | Check the error stack in terminal logs |
| AI doesn't call the tool | Description is too vague | Make the tool description more specific, include parameter details and examples |
| Empty return value | Async operation not awaited | Add `async` to handler, add `await` to calls |
| Path not found | Relative path issues | Use `paths.getProjectRoot()` to get absolute paths |

> 💡 **Tip**: During extension development, you can add `console.log(JSON.stringify(args, null, 2))` at the beginning of your handler to print the parameters and see what the AI is passing in.

## Publishing Your Extension

### Publishing to npm

```bash
# 1. Confirm package.json info is complete
npm version patch  # 0.1.0 → 0.1.1

# 2. Publish
npm publish --access public
```

### Installing After Publishing

Other users can add your package name to their `settings.json`:

```json
{
  "packages": [
    "pi-code-stats"
  ]
}
```

### Pre-Publishing Checklist

- [ ] `package.json` has a complete `description` and `keywords`
- [ ] `README.md` is written following the template (installation, usage, configuration, examples)
- [ ] Has a `LICENSE` file
- [ ] Has a `CHANGELOG.md`
- [ ] Code has basic error handling
- [ ] Tool descriptions (prompts/*.md) are clear and complete

## Extension Development Best Practices

### ✅ Good Extension Design

1. **Single Responsibility**: One extension does one thing — don't cram all functionality into a single package
2. **Description as Documentation**: Write tool descriptions clearly enough that the AI doesn't have to guess
3. **Parameter Validation**: Validate parameters in the handler and provide meaningful error messages
4. **Idempotent Operations**: Same input should produce the same output — avoid side effects

### ✅ Writing Good Tool Descriptions

```markdown
# Good description
Count lines of code for a specific file type in a given directory.
Parameters:
- directory (required): directory path
- extension (optional): file suffix, defaults to "ts"
Returns: { totalLines, fileCount, topFiles }
```

```markdown
# Bad description
Count code
```

### ❌ Common Mistakes

- Tool name too generic: `analyze` → should be `code_stats`
- Description too brief: AI doesn't know how to use it and will pass wrong parameters
- Forgetting error handling: crashes when file doesn't exist
- Return value too large: returning the entire file content → should return a summary

## Appendix: pi Extension API Quick Reference

### registerTool

```typescript
pi.registerTool({
  name: string,           // Tool name (unique identifier, AI uses this to call it)
  label: string,          // Display name (optional, shown in TUI)
  description: string,    // Tool description (what AI sees, determines when AI calls it)
  promptSnippet: string,  // Short description (injected into AI system prompt)
  promptGuidelines: string[],  // AI usage guidelines (optional)
  parameters: TypeBox.Object({...}) | JSONSchema,  // Parameter definition
  async execute(
    toolCallId: string,   // Tool call ID
    params: any,          // Parameters passed by AI
    signal?: AbortSignal, // Cancel signal (optional)
    onUpdate?: Function,  // Streaming update callback (optional)
    ctx?: any             // Execution context (optional)
  ): Promise<ToolResult>
});
```

> 💡 The `execute` return value is directly passed back to AI as the tool result. Format: `{ content: [{ type: "text", text: "..." }], details: {} }`.

### registerCommand

```typescript
pi.registerCommand(name: string, {
  description: string,    // Command description
  handler: async (args: string, ctx) => {
    // args: text entered by user (text after /command)
    // ctx.ui.notify(message, level): Show notification
  }
});
```

### Event Listeners

```typescript
// Listen to pi lifecycle events
pi.on('agent_start', (event, ctx) => { ... });
pi.on('agent_end', (event, ctx) => { ... });
pi.on('tool_call', (event, ctx) => { ... });    // Before tool call
pi.on('tool_result', (event, ctx) => { ... });  // After tool returns
pi.on('session_start', (event, ctx) => { ... });
pi.on('session_shutdown', (event, ctx) => { ... });
pi.on('before_provider_request', (event, ctx) => {
  // Inject additional info before sending AI request
  // event.messages.push({ role: 'user', content: '...' })
});
```

### Helper Methods

```typescript
pi.appendEntry(role: string, content: string);  // Append a message to the session
ctx.ui.notify(message: string, level: 'info' | 'warning' | 'error');  // Show notification
```

> 📖 For detailed API documentation, refer to the pi SDK type definitions and [pi extension development docs](https://github.com/catlain/pi-atelier).

## Congratulations, You've Made It!

Now you understand all the core concepts of pi-atelier:

1. **Memory** (pi-memory) — Let AI remember knowledge
2. **Planning** (pi-roadmap) — Let AI manage tasks
3. **Rules** (pi-shepherd + pi-context-manager) — Let AI follow rules and control information quality
4. **Retrospective** (pi-session-analyzer + pi-journal) — Let AI record and review work
5. **Compression & Diagnostics** (pi-smart-compact + pi-context-manager) — Keep AI smart in long sessions
6. **Automation** (pi-scheduler + pi-workflow) — Let AI work proactively
7. **Extensions** (pi-shared-utils + your own extensions) — Make AI capable of anything

Feel free to submit Issues and PRs on [GitHub](https://github.com/catlain/pi-atelier) — let's make the AI coding assistant better together!
