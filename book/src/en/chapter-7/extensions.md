# Building Extensions Yourself

## Why Write Your Own Extension?

pi-atelier provides 11 extensions covering core scenarios like memory, planning, rules, review, compaction, and automation. But every project has its own specific needs:

- Your team uses Feishu instead of Slack — you need a Feishu notification extension
- You're doing game development — you need an extension to auto-manage the assets directory
- You're writing academic papers — you need a LaTeX compilation + citation checking extension

> 💡 **An extension is essentially giving the AI new tools and new knowledge.**

## Extension Architecture

### What Makes Up an Extension?

```
pi-xxx/
├── package.json        # Package metadata + pi extension config
├── index.ts            # Entry point, registers tools and hooks
├── lib/                # Tool implementations
│   └── tools-xxx.ts
├── prompts/            # Prompt templates (what the AI sees)
│   └── xxx-description.md
└── README.md           # Documentation
```

### Core Concepts

| Concept | Description | Analogy |
|---------|-------------|---------|
| **Tool** | A function the AI can call | Give the AI a new hammer |
| **Hook** | Logic that runs at specific moments | Give the AI an alarm clock |
| **Prompt** | Tool description (what the AI reads) | Tell the AI how to use the hammer |
| **Config** | User-configurable parameters | The hammer's power adjustment |

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
4. Execute extension's activate() function
     │
     ├── Register tools (registerTool)
     ├── Register hooks (registerHook)
     └── Inject prompts (injectPrompt)
     │
     ▼
5. AI can call the new tools during sessions
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
  "piExtension": true,
  "activationEvents": ["onTool:code_stats"]
}
```

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
import { countLines } from './lib/tools-stats';

export function activate(context: ExtensionContext) {
  context.registerTool({
    name: 'code_stats',
    description: 'Count lines of code in a project',
    parameters: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory path to scan'
        },
        extension: {
          type: 'string',
          description: 'File extension, e.g. ts, py, rs'
        }
      },
      required: ['directory']
    },
    handler: async (args) => {
      const result = countLines(args.directory, args.extension || 'ts');
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
Count lines of code for a specific file type in a directory.

Parameters:
- directory (required): Directory path to scan
- extension (optional): File extension, defaults to "ts"

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

Restart pi, and the AI can now use the `code_stats` tool.

## pi-shared-utils: Your Toolbox

When writing extensions, you don't have to start from scratch. `pi-shared-utils` provides a set of commonly used utility functions:

| Module | Feature | When to Use |
|--------|---------|-------------|
| `logger` | Unified logging format | Printing debug info |
| `storage` | Cross-session persistent storage | Saving config or state |
| `paths` | Unified path handling | Finding file locations |
| `json` | Safe JSON read/write | Working with JSON files |
| `validator` | Parameter validation | Validating tool arguments |

### Usage Example

```typescript
import { logger, storage, paths } from 'pi-shared-utils';

// Logging
logger.info('Extension activated');
logger.warn('Config file missing, using defaults');

// Storage
const config = await storage.read('config.json');
await storage.write('config.json', { theme: 'dark' });

// Paths
const projectRoot = paths.getProjectRoot();
const memoryDir = paths.getMemoryDir();
```

## Debugging Your Extension

Common issues during extension development: tools are registered but the AI doesn't call them, the handler throws errors without visible logs, or the return value isn't what you expected.

### Viewing Log Output

Output from `logger.info()` and `console.log()` in your extension appears in pi's **terminal window** (not the chat window). Debug steps:

```bash
# Start pi in the terminal (not in the background) to see all log output
pi

# Then ask the AI to call your tool in the chat window
# The terminal will display the log output
```

### Confirm Tool Registration

Ask the AI directly in the pi chat:

```
What tools do you have available? Can you see code_stats?
```

If the AI can't see your tool, check:
- `"piExtension": true` is set in `package.json`
- The package path in `settings.json` is correct
- The `activate()` function is properly exported

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| AI can't see the tool | Missing `piExtension` field | Add `"piExtension": true` to package.json |
| Tool call throws an error | Exception inside handler | Check the error stack in terminal logs |
| AI won't call the tool | Description is too vague | Make the description more specific, include parameter docs and examples |
| Empty return value | Async operation not awaited | Add `async` to handler and `await` to calls |
| Path not found | Relative path issues | Use `paths.getProjectRoot()` to get absolute paths |

> 💡 **Tip**: When developing an extension, you can add `console.log(JSON.stringify(args, null, 2))` in the handler to print the arguments first and confirm what the AI is passing in.

## Publishing Your Extension

### Publishing to npm

```bash
# 1. Make sure package.json info is complete
npm version patch  # 0.1.0 → 0.1.1

# 2. Publish
npm publish --access public
```

### Installation After Publishing

Other users can add your package name to their `settings.json`:

```json
{
  "packages": [
    "pi-code-stats"
  ]
}
```

### Pre-Publish Checklist

- [ ] `package.json` has a complete `description` and `keywords`
- [ ] `README.md` is filled out using the template (install, usage, config, examples)
- [ ] Has a `LICENSE` file
- [ ] Has a `CHANGELOG.md`
- [ ] Code includes basic error handling
- [ ] Tool descriptions (`prompts/*.md`) are clear and complete

## Extension Development Best Practices

### ✅ Good Extension Design

1. **Single Responsibility**: One extension does one thing — don't cram everything into one package
2. **Description is Documentation**: Write tool descriptions clearly enough that the AI doesn't need to guess
3. **Parameter Validation**: Validate arguments in the handler and provide meaningful error messages
4. **Idempotent Operations**: Same input should produce the same output — avoid side effects

### ✅ Writing Good Tool Descriptions

```markdown
# Good description
Count lines of code for a specific file type in a directory.
Parameters:
- directory (required): Directory path
- extension (optional): File extension, defaults to "ts"
Returns: { totalLines, fileCount, topFiles }
```

```markdown
# Bad description
Count code
```

### ❌ Common Mistakes

- Tool name too generic: `analyze` → should be `code_stats`
- Description too short: AI doesn't know how to use it and will pass wrong parameters
- Forgetting error handling: crashes when a file doesn't exist
- Return value too large: returning the entire file content → should return a summary

## Appendix: pi Extension API Quick Reference

### registerTool

```typescript
context.registerTool({
  name: string,           // Tool name (unique identifier)
  description: string,    // Tool description (what the AI sees)
  parameters: JSONSchema, // JSON Schema for parameters
  handler: (args) => any  // Execution function
});
```

### registerHook

```typescript
context.registerHook({
  event: 'before_edit' | 'after_edit' | 'before_bash' | 'after_bash' | 'agent_end',
  handler: (context) => HookResult
});
```

### injectPrompt

```typescript
context.injectPrompt({
  target: 'system' | 'tool_description',
  content: string
});
```

## Congratulations, You've Made It!

Now you understand all the core concepts of pi-atelier:

1. **Memory** (pi-memory) — Let the AI remember knowledge
2. **Planning** (pi-roadmap) — Let the AI manage tasks
3. **Rules** (pi-shepherd + pi-context-manager) — Let the AI follow rules
4. **Review** (pi-journal + pi-session-analyzer) — Let the AI record its work
5. **Compaction & Diagnosis** (pi-smart-compact + pi-context-manager) — Keep the AI sharp
6. **Automation** (pi-scheduler + pi-workflow) — Let the AI work proactively
7. **Extensions** (pi-shared-utils + your own extensions) — Make the AI omnipotent

Feel free to submit Issues and PRs on [GitHub](https://github.com/catlain/pi-atelier) to help make this AI coding assistant even better!
