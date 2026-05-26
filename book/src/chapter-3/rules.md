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

Shepherd（牧羊犬）在 AI 的关键动作前做检查，相当于"门卫"。

```
AI 准备执行动作
     │
     ▼
┌──────────────────┐
│   Shepherd 钩子   │
│  检查：该不该做？  │
└──────┬───────────┘
       │
   ┌───┴───┐
   │       │
  放行    阻止 + 提示原因
```

支持的钩子时机：

| 钩子 | 触发时机 | 典型用途 |
|------|----------|----------|
| `before_edit` | AI 编辑文件前 | 检查是否改了不该改的文件 |
| `before_write` | AI 写新文件前 | 检查文件路径是否合理 |
| `before_bash` | AI 执行命令前 | 禁止危险命令（rm -rf /） |
| `after_bash` | 命令执行后 | 自动格式化、lint 检查 |
| `agent_end` | 会话结束前 | 提醒提交代码、更新文档 |

### 第二道：pi-context — 信息质量

Context（上下文管家）控制 AI 能看到什么信息，相当于"图书馆管理员"。

AI 的"聪明程度"直接取决于它能看到的上下文质量。如果上下文里有噪音（过期的日志、无关的文件内容），AI 就会做出错误的判断。

pi-context 的核心能力：

- **Distill（蒸馏）**：对工具返回的大段内容做压缩，保留关键信息
- **过滤**：按规则屏蔽不相关的内容
- **优先级排序**：重要的信息排前面

```
工具返回大量内容（可能 50KB）
     │
     ▼
┌──────────────────┐
│   Context Distill │
│  压缩到 5KB 关键信息 │
└──────────────────┘
     │
     ▼
AI 看到精炼后的信息，做出更好的判断
```

## 实际案例：防止 AI 犯错

### 场景 1：禁止修改系统文件

```json
{
  "rules": [
    {
      "id": "no-system-files",
      "hook": "before_edit",
      "condition": "filePath matches '.pi/memory/.*'",
      "action": "deny",
      "message": "记忆文件只能通过 memory_update 工具修改，不要直接编辑"
    }
  ]
}
```

这样当 AI 尝试用 `edit` 工具直接修改记忆文件时，shepherd 会拦截并告诉它用正确的方式。

### 场景 2：会话结束提醒

```json
{
  "rules": [
    {
      "id": "commit-reminder",
      "hook": "agent_end",
      "action": "inject",
      "message": "检查是否有未提交的改动。如果有，提交并推送到远程仓库。"
    }
  ]
}
```

AI 在会话结束前会自动检查 git 状态，不会遗漏提交。

### 场景 3：自动 lint

```json
{
  "rules": [
    {
      "id": "auto-lint",
      "hook": "after_bash",
      "condition": "command matches 'edit|write'",
      "action": "run",
      "command": "npx eslint {filePath}"
    }
  ]
}
```

每次 AI 编辑文件后自动跑 lint，保证代码质量。

## Shepherd 规则的配置方式

规则存储在 `shepherd/rules.json` 中，每条规则包含：

| 字段 | 说明 | 示例 |
|------|------|------|
| `id` | 规则唯一标识 | `"no-system-files"` |
| `hook` | 触发时机 | `"before_edit"` |
| `condition` | 触发条件（可选） | `"filePath matches 'src/.*'"` |
| `action` | 执行动作 | `"deny"` / `"inject"` / `"run"` |
| `message` | 提示信息 | `"不要直接编辑记忆文件"` |

### 常用规则模板

```json
{
  "rules": [
    {
      "id": "protect-config",
      "hook": "before_edit",
      "condition": "filePath matches '(package\\.json|tsconfig\\.json)$'",
      "action": "warn",
      "message": "正在修改配置文件，请确认这是有意的"
    },
    {
      "id": "no-force-push",
      "hook": "before_bash",
      "condition": "command matches 'push.*--force'",
      "action": "deny",
      "message": "禁止 force push，这会覆盖远程历史"
    },
    {
      "id": "test-reminder",
      "hook": "agent_end",
      "action": "inject",
      "message": "运行测试确认所有测试通过后再提交"
    }
  ]
}
```

## Context 的配置方式

pi-context 通过 `settings.json` 中的 `packages` 配置安装，默认提供：

- 自动 distill 大型工具输出
- 按优先级排序上下文
- 可通过 AGENTS.md 注入全局提示

高级用户可以在 `.pi/config.json` 中自定义过滤规则。

## 最佳实践

### ✅ 好的规则设计

- **精确的条件**：只拦截需要拦截的场景，不要一刀切
- **清晰的提示**：告诉 AI "为什么不行"和"应该怎么做"
- **分层防护**：重要的事情用 `deny`（强制），次要的用 `warn`（提醒）

### ❌ 不好的规则设计

- **过于宽松**：`"condition": "always"` 会拦截所有操作，AI 什么都做不了
- **过于严厉**：禁止所有 `bash` 命令，AI 连 `ls` 都不能执行
- **模糊的提示**：`"message": "注意"` —— 注意什么？

### 规则的优先级

当多条规则同时匹配时：

1. `deny` > `warn` > `inject`
2. 同优先级下，后定义的先生效
3. `agent_end` 钩子按定义顺序依次执行

## 下一步

有了记忆、规划和规矩，AI 已经是一个靠谱的助手了。但一个会话做了很多事之后——你怎么知道它具体做了什么？哪些文件改了？哪些决策做了？

下一章，我们来看如何让 AI 学会**复盘**。
