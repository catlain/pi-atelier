# pi-atelier：让 AI 编程助手变得专业

## 这本书是给谁看的？

如果你在做以下任何一件事，这本书适合你：

- 用 AI 编程助手（如 pi、Cursor、Copilot）写代码
- 觉得 AI 助手"差一点"就能做得更好
- 想让 AI 从"问答工具"进化成"项目搭档"

## 什么是 pi-atelier？

pi-atelier 是一组 **pi 扩展**，让 AI 编程助手具备项目管理能力。

普通 AI 助手能写代码，但：
- 每次开会话都忘光之前的事
- 做大任务容易跑偏
- 没有规矩，容易犯低级错误
- 会话一长就变笨

pi-atelier 的扩展补上了这些能力缺口：

| 能力 | 扩展 | 一句话描述 |
|------|------|-----------|
| 记忆 | pi-memory | 让 AI 记住跨会话的知识 |
| 规划 | pi-roadmap | 让 AI 管理 Epic → Story → Task |
| 守卫 | pi-shepherd | 给 AI 立规矩，防止犯错 |
| 上下文与诊断 | pi-context-manager | 控制 AI 看到的信息质量 + token 消耗诊断 |
| 日志 | pi-journal | 自动记录每个会话做了什么 |
| 分析 | pi-session-analyzer | 搜索和回溯历史会话 |
| 压缩 | pi-smart-compact | 长会话中保持 AI 的聪明 |
| 定时 | pi-scheduler | 定时提醒和周期任务 |
| 工作流 | pi-workflow | 子代理编排，并行执行 |
| 工具库 | pi-shared-utils | 扩展开发的公共工具函数 |

## 阅读路线

### 快速上手路线（1 小时）

1. 第一章：一个 AI 的记忆 → 5 分钟装上 pi-memory
2. 第二章：从记忆到规划 → 学会用路线图管理任务
3. 第七章：自己动手做扩展 → 了解扩展机制

### 全面了解路线（3 小时）

按顺序读完所有章节。每章包含：
- **痛点**：你一定会遇到的真实问题
- **原理**：扩展是怎么工作的
- **案例**：真实的使用场景
- **最佳实践**：怎么用得更好

### 按需查阅路线

遇到具体问题时，直接翻到对应章节。每章独立完整。

## 快速安装

在 pi 的 `settings.json` 中添加你需要的扩展：

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

或者全部安装：

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

全部扩展都是 **开箱即用**——安装后无需额外配置（但你可以按需定制）。

## 重要文件路径

在开始之前，你需要知道 pi 的关键文件在哪里：

| 文件 | 路径 | 说明 |
|------|------|------|
| 全局配置 | `~/.pi/settings.json` | 安装扩展、配置 provider |
| 项目配置 | `.pi/config.json`（项目根目录） | 项目级自定义配置 |
| 项目指令 | `.pi/agent/AGENTS.md`（项目根目录） | 注入给 AI 的项目规则 |
| 扩展安装目录 | `~/.pi/agent/npm/node_modules/` | npm 包安装位置 |
| 记忆目录 | `.pi/memory/`（项目级） | 项目级持久记忆 |
| 全局记忆 | `~/.pi/agent/memory/` | 跨项目通用记忆 |

> 💡 **新手提示**：`~` 指你的用户主目录。在 macOS/Linux 上是 `/home/你的用户名/`，Windows 上是 `C:\Users\你的用户名\`。

## 约定

本书中的示例使用以下约定：

- `代码块`：命令、文件路径、代码片段
- **粗体**：重要概念
- > 💡 提示：实用技巧和注意事项
- 表格：快速对比和速查

准备好开始了吗？翻开第一章，让我们从"记忆"开始。
