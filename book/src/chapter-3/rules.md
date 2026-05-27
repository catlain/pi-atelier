# 给 AI 立规矩

## 你可能遇到过这种情况

你让 AI 帮你"修一下登录页面的样式"。30 秒后你看了一眼代码——

AI 不但改了样式，还：
- "顺手"重构了整个登录组件的目录结构
- 把 CSS 模块改成了 Tailwind（你项目没用 Tailwind）
- 删除了 3 个它认为"没用"的测试文件
- 把 package.json 里的依赖升级到了最新版

等你发现的时候，代码已经提交了。

> 💡 **AI 越能干，越需要规矩**。能力强但没有边界，造成的破坏反而更大。

## 两道防线：Shepherd 和 Context

pi-atelier 提供了两层防护机制：

### 第一道：pi-shepherd — 行为守卫

Shepherd（牧羊犬）是一个**规则驱动的事件钩子引擎**，在 AI 的关键动作前后做检查，相当于"门卫"。

```
AI 准备执行动作（工具调用）
     │
     ▼
┌──────────────────────────────┐
│     Shepherd tool_call 钩子   │
│   检查：该不该做？该怎么做？    │
└──────┬───────────────────────┘
       │
   ┌───┴────┐
   │        │
  放行     改写/阻止 + 提示原因

... 工具执行完毕 ...

┌──────────────────────────────┐
│    Shepherd tool_result 钩子  │
│   检查：需要后续动作吗？       │
└──────┬───────────────────────┘
       │
   注入提醒 / 追加动作
```

支持的钩子时机：

| 钩子 | 触发时机 | 典型用途 |
|------|----------|----------|
| `tool_call` | AI 调用工具**前** | 改写命令、阻止危险操作 |
| `tool_result` | 工具执行**后** | 自动提醒跑测试、lint 检查 |
| `agent_end` | AI 完成对话**时** | 提醒提交代码、更新记忆 |
| `session_shutdown` | 会话关闭**时** | 清理临时数据 |

Shepherd 的四种动作：

| 动作 | 效果 | 典型用途 |
|------|------|----------|
| `notify` | 向 AI 上下文注入提醒 | "编辑了 TS 文件，记得跑测试" |
| `steer` | 静默注入引导（不显示给用户） | 引导 AI 查阅规范 |
| `rewrite` | 改写工具调用参数 | 自动给命令加前缀 |
| `deny` | 阻止工具执行 | 禁止危险操作 |

### 第二道：pi-context-manager — 信息质量与诊断

Context Manager（上下文管家）控制 AI 能看到什么信息，还能帮你诊断 token 消耗问题。

核心能力：

- **Distill（蒸馏）**：自动压缩工具返回的大段内容，保留关键信息
- **Tool Result Processor（后处理器）**：对特定工具输出做格式化精简
- **Aging（老化淘汰）**：自动淘汰长期未被引用的旧工具输出
- **Payload 分析**：用数据诊断 token 都花在哪了

```
工具返回大量内容（可能 50KB）
     │
     ▼
┌────────────────────────┐
│   Context Manager       │
│   Distill + Processor   │
│   压缩到 ~5KB 关键信息   │
└────────────────────────┘
     │
     ▼
AI 看到精炼后的信息，做出更好的判断
```

详细原理见 [3.3 Context Manager 原理](./context.md)。

## 实际案例：防止 AI 犯错

### 场景 1：编辑后自动提醒跑测试

```json
{
	"comment": "[TypeScript] 编辑后必须跑测试",
	"hook": "tool_result",
	"tool": "edit",
	"action": "notify",
	"conditions": [
		{ "field": "path", "pattern": "\\.ts$", "flags": "" }
	],
	"reason": "编辑了 TypeScript 文件，必须跑覆盖该代码的单元测试（如无测试则先补充），修复所有测试问题确保通过。",
	"enabled": true
}
```

当 AI 编辑了 `.ts` 文件后，Shepherd 自动提醒 AI 跑测试。

### 场景 2：会话结束提醒提交代码

```json
{
	"comment": "[收尾] 编辑后提醒 commit + 记忆更新 + 总结",
	"hook": "agent_end",
	"action": "notify",
	"check": "has_edits",
	"reason": "检测到文件编辑，执行收尾工作：\n1️⃣ Git commit...\n2️⃣ 更新记忆...\n3️⃣ 会话总结",
	"stopReason": ["stop"],
	"enabled": true
}
```

`check: "has_edits"` 表示只有本轮会话确实编辑了文件才触发。`stopReason: ["stop"]` 表示只在 AI 正常结束（而非被中断）时触发。

### 场景 3：自动改写命令

```json
{
	"comment": "[rtk] 自动代理高频 bash 命令",
	"tool": "bash",
	"action": "rewrite",
	"pattern": "^(git\\s+(status|log|diff)|cargo\\s+(test|build|clippy)|pytest)\\b",
	"flags": "",
	"reason": "rtk command rewrite：自动加 rtk 前缀压缩输出",
	"enabled": true
}
```

当 AI 尝试执行 `git status` 等命令时，Shepherd 自动改写为 `rtk git status`（rtk 是一个输出压缩工具）。

### 场景 4：代码风格检查

```json
{
	"comment": "[TS] 禁止空格缩进 — TS 文件必须用 Tab",
	"hook": "tool_call",
	"tool": "edit",
	"action": "notify",
	"conditions": [
		{ "field": "path", "pattern": "\\.ts$", "flags": "" },
		{ "field": "text", "pattern": "\\n  [\\S ]", "flags": "" }
	],
	"reason": "❌ TS 文件要求 Tab 缩进，不是空格。请用 Tab 缩进重写代码。",
	"enabled": true
}
```

**两个条件同时满足**才触发：文件是 `.ts` 且代码内容包含空格缩进。

### 场景 5：连续出错时提醒翻记忆

```json
{
	"comment": "[debug] 工具反复出错时提醒翻记忆",
	"hook": "tool_result",
	"action": "steer",
	"state": { "countKind": "errors", "gte": 5 },
	"reason": "🔍 **工具反复出错**：连续失败多次，翻看 .pi/memory/ 目录下的记忆文件，看是否已有踩坑记录。",
	"enabled": true,
	"subagent": false
}
```

`state` 实现了**状态追踪**——Shepherd 会记住工具出错的次数，累计到阈值才触发。`subagent: false` 表示子代理中不触发此规则。

## Shepherd 规则配置详解

### 规则文件位置

| 级别 | 路径 | 说明 |
|------|------|------|
| 全局默认 | 扩展包内的 `rules.json` | Shepherd 自带的规则集 |
| 项目级 | `.pi/shepherd-rules-*.json`（项目根目录） | 项目自定义规则，可建多个文件 |

修改规则文件后 `/reload` 即可生效，无需重启 pi。

### 规则字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `comment` | ✅ | 规则注释，方便理解 |
| `hook` | ✅ | 触发时机：`tool_call` / `tool_result` / `agent_end` / `session_shutdown` |
| `tool` | ❌ | 限定只匹配特定工具（如 `"edit"`、`"bash"`、`"grep"`） |
| `action` | ✅ | 动作：`notify` / `steer` / `rewrite` / `deny` |
| `conditions` | ❌ | 条件数组，所有条件同时满足才触发 |
| `pattern` | ❌ | 正则匹配（匹配工具参数或命令内容） |
| `reason` | ✅ | 注入给 AI 的提示文本（`notify`/`steer` 动作时） |
| `state` | ❌ | 状态追踪（如累计错误次数） |
| `check` | ❌ | 全局检查（如 `has_edits` 检查是否编辑了文件） |
| `stopReason` | ❌ | 限定 AI 结束原因（如 `["stop"]` 只在正常结束时触发） |
| `subagent` | ❌ | 是否在子代理中也触发（默认 `true`） |
| `requireSuccess` | ❌ | 是否只在工具成功时触发（默认 `false`） |
| `requiresTools` | ❌ | 限定只在某些 MCP 工具可用时触发 |
| `enabled` | ✅ | 是否启用 |

### 条件匹配

`conditions` 数组中的每个元素：

```json
{
	"field": "path",     // 匹配哪个字段：path（文件路径）或 text（工具参数内容）
	"pattern": "\\.ts$", // 正则表达式
	"flags": ""          // 正则标志（如 "i" 不区分大小写、"s" 单行模式）
}
```

### 三层配置合并

Shepherd 的配置（如 `projectRulesPattern`、`maxWarnings`）通过 pi-shared-utils 的 `getEffectiveConfig` 做三层合并：

```
defaults → 全局 ~/.pi/agent/settings.json → 项目 .pi/settings.json
```

在 `.pi/settings.json` 中可以覆盖 Shepherd 的配置：

```json
{
	"shepherd": {
		"projectRulesPattern": "my-rules-",
		"maxWarnings": 3
	}
}
```

## Context 的配置方式

pi-context-manager 提供以下命令：

| 命令 | 用途 |
|------|------|
| `/record [on\|off]` | 开关 payload 录制 |
| `/context` | TUI 面板：可视化上下文使用情况 |
| `/distill-config [N]` | 查看/设置 distill token 阈值 |
| `/distill-config --cap [N]` | 查看/设置首次全文上限（`firstSeenCap`，0 = 不设上限） |
| `/processor-config [N\|off]` | 查看/设置 tool-result-processor 阈值 |
| `/aging-config [N\|off]` | 查看/设置 aging 淘汰轮数 |
| `/context-clean [sessionId]` | 清理持久化数据 |

> 💡 **所有命令无参调用时显示当前配置和用法说明**，例如直接输入 `/distill-config` 即可查看当前阈值和用法。

详细原理见 [3.3 Context Manager 原理](./context.md)。

## 最佳实践

### ✅ 好的规则设计

- **精确的条件**：用 `conditions` 限定触发范围，不要一刀切
- **清晰的提示**：告诉 AI "为什么不行"和"应该怎么做"
- **分层防护**：重要的事情用 `deny`（强制），次要的用 `notify`（提醒），内部引导用 `steer`（静默）
- **善用状态追踪**：连续出错 3 次再提醒，比每次都提醒更有效

### ❌ 不好的规则设计

- **过于频繁**：每个工具调用都 `notify`，AI 会被提醒淹没
- **过于严厉**：`deny` 所有 `bash` 命令，AI 连 `ls` 都不能执行
- **模糊的提示**：`"reason": "注意"` —— 注意什么？
- **忽略子代理**：某些规则用 `"subagent": false` 排除子代理场景，避免干扰独立任务

### 规则的优先级

当多条规则同时匹配时：

1. `deny` > `notify` > `steer`（阻止 > 提醒 > 静默引导）
2. 同优先级下，按规则文件中的定义顺序依次执行
3. `agent_end` 钩子中，`check` 条件不满足的规则直接跳过

## 下一步

有了记忆、规划和规矩，AI 已经是一个靠谱的助手了。但一个会话做了很多事之后——你怎么知道它具体做了什么？哪些文件改了？哪些决策做了？

下一章，我们来看如何让 AI 学会**复盘**。
