# Pi 扩展开发规范

> 适用于 `~/.pi/agent/extensions/` 和 `<project>/.pi/extensions/` 下的所有扩展。

## 目录结构

```
extensions/<name>/
├── index.ts          # 扩展入口（必需）
├── lib/              # 业务逻辑拆分（可选，index.ts 超 150 行时使用）
│   ├── rules.ts      # 按职责命名
│   └── ...
├── tests/            # 测试（可选）
├── vitest.config.ts  # 测试配置（可选）
└── package.json      # npm 依赖（可选，仅需要外部包时）
```

## 入口文件模式

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function myExtension(pi: ExtensionAPI) {
  // 注册事件 hook
  pi.on("session_start", async (event, ctx) => { ... });
  pi.on("tool_call", async (event, ctx) => { ... });

  // 注册工具
  pi.registerTool({ ... });

  // 注册命令
  pi.registerCommand("mycommand", { ... });
}
```

## 消息注入：sendMessage vs sendUserMessage

**禁止使用 `pi.sendUserMessage()`**。它会把消息伪装成用户输入，污染会话记录。

统一使用 `pi.sendMessage()`：

```typescript
pi.sendMessage(
  {
    customType: "<扩展名>-<事件>",
    display: true,
    content: "消息内容",
  },
  { deliverAs: "steer", triggerTurn: true },
);
```

- `customType` 命名：`<扩展名>-<场景>`，如 `guard-tool-result`、`guard-agent-end`
- `deliverAs: "steer"`：当前 turn 结束后注入 LLM 上下文
- `triggerTurn: true`：agent idle 时立即触发新 turn
- `display: true`：TUI 中可见

## 事件 Hook 选择

| Hook | 触发时机 | 典型用途 |
|------|---------|---------|
| `session_start` | 会话启动 | 初始化、索引构建 |
| `agent_start` | 每次 AI turn 开始 | 重置状态 |
| `agent_end` | AI 正常完成 | 提醒、收尾 |
| `session_shutdown` | 会话结束 | 资源清理 |
| `input` | 用户输入 | 用户行为追踪 |
| `turn_start` | turn 开始处理 | 状态栏更新 |
| `before_agent_start` | AI 调用前 | 系统提示词修改 |
| `tool_call` | 工具调用前 | 拦截/block/重写 |
| `tool_result` | 工具执行后 | 状态更新/提醒 |
| `custom: <name>` | 自定义事件 | 扩展间通信 |

### 子代理感知

子代理（subagent spawn）继承扩展。通过环境变量判断：

```typescript
const isSubagent = () => !!(process.env.PI_SUBAGENT_AGENT || process.env.PI_SUBAGENT_SESSION);
```

需要跳过子代理时在 hook 回调开头加 `if (isSubagent()) return;`。

## 工具注册

```typescript
pi.registerTool({
  name: "tool_name",           // 全局唯一
  label: "Display Name",
  description: "给 AI 看的说明",
  promptSnippet: "简短标签",    // 可选
  promptGuidelines: [...],      // 可选：注入 system prompt
  parameters: Type.Object({     // typebox schema
    param: Type.String({ description: "..." }),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    return {
      content: [{ type: "text", text: "结果" }],
      details: {},
    };
  },
});
```

## 命令注册

```typescript
pi.registerCommand("command-name", {
  description: "命令说明",
  handler: async (args, ctx) => {
    ctx.ui.notify("消息", "info");
  },
});
```

## UI API

```typescript
// 通知（TUI toast，AI 看不到）
ctx.ui.notify("消息", "info" | "warning" | "error" | "success");
ctx.ui.confirm("标题", "内容？");  // → boolean

// 状态栏
ctx.ui.setStatus("key", "文本");
ctx.ui.setStatus("key", undefined);  // 清除

// 小组件
ctx.ui.setWidget("key", lines);       // 显示
ctx.ui.setWidget("key", undefined);   // 清除

// 主题颜色：只能用 pi 预定义名（dim/muted/accent/warning/error/success/toolTitle/toolOutput）
ctx.ui.theme.fg("dim", "文本");
ctx.ui.theme.bold("文本");
```

## 状态持久化

```typescript
// 写入（不进 LLM 上下文，reload 后可恢复）
pi.appendEntry("my-type", { data: 42 });

// 读取
ctx.sessionManager.getEntries()
  .filter(e => e.type === "custom" && e.customType === "my-type");
```

## 拆分模式

当 index.ts 超过 150 行时，按职责拆到 `lib/`：

| 模式 | 示例 |
|------|------|
| 规则/配置 → 独立文件 | guard → `lib/rules.ts` |
| 复杂检查逻辑 → 独立文件 | guard → `lib/line-count.ts`, `lib/worktree-check.ts` |
| 有状态引擎 → 独立文件 | guard → `lib/state-tracker.ts` |
| 工具实现 → 独立文件 | session-analyzer → `search.ts` + `analyze.ts` |
| 公共类型 → 独立文件 | scheduler → `types.ts` |
| parser/序列化 → 独立文件 | scheduler → `parser.ts` |

拆分后 index.ts 只做 hook 注册和调度，不超过 300 行。

## 导入规范

```typescript
// pi 核心 API
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";           // schema 定义
import { StringEnum } from "@mariozechner/pi-ai";   // 枚举工具参数
```

## 常见陷阱

1. **CRLF 换行**：Windows 环境可能引入 CRLF，用 `audit_format.py --fix` 修复
2. **Tab vs 空格**：扩展代码用 Tab 缩进（与 pi 上游一致）
3. **`hasUI` 检查**：子代理无 TUI，`ctx.ui.notify` 等需检查 `ctx.hasUI`
4. **`ctx.ui.notify` vs `pi.sendMessage`**：notify 只是 TUI toast，AI 看不到；sendMessage 才能注入 LLM 上下文
5. **`setTimeout` + `sendMessage`**：agent_end 时 isStreaming 仍为 true，需 setTimeout 推到下一宏任务
6. **路径解析**：用 `import.meta.url` 而非 `__dirname`（ESM）
7. **Windows 路径**：`new URL(import.meta.url).pathname` 在 Windows 上需要 `.replace(/^\/([A-Z]:)/, "$1")`
