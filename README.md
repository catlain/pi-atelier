# pi-atelier

[pi](https://github.com/earendil-works/pi-coding-agent) 的扩展工具集——为你的 AI 编程助手装上更多武器。

## 安装

```bash
pi install git:github.com/catlain/pi-atelier
```

一行命令，pi 会自动 clone 到 `~/.pi/agent/git/`、运行 `npm install`、发现并注册所有扩展。重启 pi 即可使用。

> **前提：** 已安装 [pi](https://github.com/earendil-works/pi-coding-agent)。

## 停用/卸载

**停用单个扩展**（不删除代码）：编辑 `~/.pi/agent/settings.json`，在 `extensions.disabled` 数组中添加扩展名：

```json
{
  "extensions.disabled": ["journal", "scheduler"]
}
```

**完全卸载整个工具集：**

```bash
pi uninstall pi-atelier
```

---

## 扩展一览

### 🔧 基础设施

#### env-and-status — 环境注入 + 索引管理

**做什么：** 每轮对话自动注入环境信息（Session ID、当前目录、日期）、加载记忆文件、管理 Cartog 代码图索引。

**实现逻辑：** 监听 `before_provider_request` 事件，将环境信息注入到 LLM 请求的 system 区。Cartog 索引管理通过 `cartog-manager` 库扫描项目目录，构建代码图供其他工具（rag_search 等）使用。

**外部依赖：** 需要 [cartog](https://github.com/nicholasgasior/cartog) CLI（可选，用于代码图搜索功能）。

**配置文件：**
- `~/.pi/agent/cartog-index.json` — 全局 Cartog 外部索引目录
- `<project>/.pi/cartog-index.json` — 项目级索引覆盖

---

#### mcp-lite — MCP 工具桥接

**做什么：** 将外部 MCP（Model Context Protocol）服务器的能力桥接为 pi 可调用的工具。提供 Web 搜索、网页阅读、GitHub 仓库分析、代码图搜索、视觉分析等能力。

**实现逻辑：** 读取 MCP 服务器配置（URL 或 Stdio 命令），按需建立连接（lazy connect），将 MCP tool 映射为 pi tool。支持 StreamableHTTP、SSE、Stdio 三种传输协议。

**外部依赖（按需，缺哪个就哪个不可用）：**
- **智谱 GLM API Key** — Web 搜索、网页阅读、视觉分析。在 `~/.pi/agent/models.json` 中配置：
  ```json
  { "providers": { "glm": { "apiKey": "your-key" } } }
  ```
- **Cartog CLI** — 代码图搜索（rag_search、refs、callees 等）
- **GitHub** — 仓库文档/代码/结构搜索（无需配置，公开仓库直接可用）

**配置文件：** `~/.pi/agent/extensions/mcp-lite/config.json`

---

#### context — 上下文三层处理引擎

**做什么：** 管理 LLM 上下文窗口，通过三层机制控制上下文增长：

1. **Processor（后处理器）** — 工具返回超大结果时，自动格式化压缩或写入临时文件，保留摘要在上下文中。`tool_result` 事件触发。
2. **Distill（蒸馏）** — 上下文发送前，检测超过 token 阈值的工具结果。首次超标：保留全文 + 提示用户读取需要的内容。再次遇到：静默移除工具结果及关联的 toolCall。`context` 事件触发。
3. **Aging（老化遗忘）** — 跟踪每个工具结果被发送给 LLM 的次数，达到阈值轮次后自动移除。模拟人类"短期记忆衰减"，防止上下文无限膨胀。与 distill 互斥（已被 distill 处理的跳过 aging）。

**`/context` 交互式可视化：** 四层导航式 TUI 界面，可逐层深入查看上下文详情：
- **总览层** — 显示 System Prompt / Tools / Messages / Available 各类别 token 占比
- **分类层** — 进入某类别后显示详细分项（如 Tools 下列出每个工具的 call/result token）
- **记录层** — 列出该分项下的所有消息记录，支持翻页滚动
- **内容层** — 查看单条消息的完整原文

额外功能：payload 录制（`/record on/off`）、toolCall 参数截断。

**实现逻辑：** 监听 pi 的 `tool_result` 和 `context` 事件。Processor 在工具返回时即时处理；Distill 和 Aging 在每次发送请求前（`context` 事件）扫描所有消息，三层串行处理。

**配置命令：**
- `/record on/off` — 开关 payload 录制
- `/distill-config [threshold]` — 查看/设置 distill token 阈值
- `/aging-config [threshold|off]` — 查看/设置 aging 轮次阈值
- `/processor-config [threshold]` — 查看/设置 processor token 阈值

**配置文件：** `~/.pi/agent/extensions/context/config.json`（存储 distillThreshold、agingThreshold、processorThreshold）

**外部依赖：** 无

---

#### notification — 完成通知

**做什么：** AI 回复结束时播放提示音 + 发送终端桌面通知。

**实现逻辑：** 监听 `agent_end` 事件，触发系统通知。

**外部依赖：** 无

---

### 🧠 记忆与会话

#### memory — 持久记忆

**做什么：** 让 AI 拥有跨会话的持久记忆。支持两级存储——L1 全局记忆（跨项目通用知识）和 L2 项目记忆（架构决策、策略结论等）。

**实现逻辑：** 基于文件的记忆系统。`memory_index` 工具扫描记忆目录返回结构化清单；`memory_update` 工具写入 markdown 文件并自动维护 `MEMORY.md` 索引。文件名格式：`topic--kw1,kw2,kw3.md`。

**外部依赖：** 无

**记忆目录：**
- L1 全局：`~/.pi/agent/memory/`
- L2 项目：`<project>/.pi/memory/`

---

#### session-analyzer — 会话分析

**做什么：** 搜索和分析历史 pi 会话。跨会话全文搜索、查找修改过特定文件的会话、深入分析单个会话的详情。

**实现逻辑：** 直接读取 `~/.pi/agent/sessions/` 下的 JSONL 会话文件，支持多种查询模式。

**提供的工具：**
- `session_search` — 三种模式：`grep`（关键词搜索）、`file`（按修改文件查找）、`list`（列出最近会话）
- `session_analyze` — 分析单个会话：`summary`（概览）、`entries`（条目列表）、`timeline`（时间线）、`chain`（子代理链追踪）、`raw`（原始数据）、`audit`（违规检查）、`takeover`（接手报告）

**外部依赖：** 无

---

### 🔄 工作流

#### plan-verify — 方案驱动开发（SDD + TDD）

**做什么：** 结构化的开发工作流，确保复杂改动有方案、有审查、有测试。防止 AI 盲目写代码。

**实现逻辑：** 状态机驱动的 10 步工作流。每步有 Gate 验证，不通过则回退。子代理执行探索、审查、测试编写、实现等任务，主代理编排流程。

**工作流步骤：** explore → plan → review-plan → fix-plan → write-test → review-test → execute → run-test → simplify → run-test

**触发方式：** AI 调用 `pv` 工具，指定 `action` 参数进入对应阶段。

**外部依赖：** 无（但如果配置了子代理 agents，可以在独立上下文中执行任务）

**相关配置：** `~/.pi/agent/agents/*.md` — 子代理定义文件

---

#### subagent — 子代理管理

**做什么：** 在独立的 pi 子进程中执行任务。每个子代理有独立的上下文窗口、工具集和 system prompt。适合需要独立视角的深度分析、代码审查、方案验证等。

**实现逻辑：** spawn pi 子进程，通过 `workflow-core` 管理状态和 UI 展示。子代理定义从 `~/.pi/agent/agents/*.md` 自动发现。

**提供的工具：** `subagent` — 参数：`name`（子代理名）、`task`（任务描述）、`model`（可选模型覆盖）

**提供的命令：** `/subagent-model` — 查看和切换子代理使用的模型

**外部依赖：** 无

**相关配置：** `~/.pi/agent/agents/*.md` — 子代理定义文件

---

#### workflow — 通用工作流引擎

**做什么：** 工作流编排的底层引擎。提供状态机、Gate 验证机制、子代理调度、UI 状态展示等构建块。

**实现逻辑：** `workflow-core` 库导出 `registerWorkflowTool`、`createStateManager`、`createUIUpdater` 等 API。plan-verify、subagent 等扩展基于此构建。

**外部依赖：** 无（这是内部共享库，不直接暴露工具/命令给用户）

---

### 🔍 开发工具

#### shepherd — 代码质量守门员

**做什么：** 基于规则的 Hook 引擎，在工具调用前后自动检查和干预。可以拦截危险操作、重写命令、注入提醒。

**实现逻辑：** 监听 `tool_call`、`tool_result`、`agent_end`、`session_shutdown` 四类事件。规则用 JSON 配置，支持正则匹配。动作类型：`block`（拦截）、`notify`（提醒）、`rewrite`（重写）、`steer`（向 LLM 注入提示）。

**规则配置文件：**
- 全局：`~/.pi/agent/extensions/shepherd/rules.json`
- 项目级：`<project>/.pi/extensions/shepherd-rules-*.json`（自动扫描叠加）

**规则示例：**
```json
{
  "tool": "bash",
  "action": "rewrite",
  "pattern": "^git status\\b",
  "reason": "自动加 rtk 前缀压缩输出",
  "enabled": true
}
```

**修改规则后** `/reload` 即可生效，无需重启 pi。

**外部依赖：** 无

---

#### payload-analyzer — Token 成本分析

**做什么：** 分析 pi 与 LLM 的通信 payload，了解 token 去向、找出最贵的工具调用、追踪上下文增长趋势。

**实现逻辑：** 读取 `/tmp/pi-distill/recordings/` 下的录制文件（由 context 扩展的录制功能产生），解析每条消息的 token 消耗。

**提供的工具：** `payload_analyze`
- `list` — 列出录制文件
- `budget` — Token 预算拆解（system/tools/history 各占多少）
- `growth` — 上下文增长趋势曲线
- `expensive` — 最贵工具调用 Top N
- `overview` — 逐消息 token 分析
- `stats` — 蒸馏/处理器命中率统计

**前提条件：** 需要先在 context 扩展中开启录制（`/record on`），产生录制文件后才能分析。

**外部依赖：** 无

---

#### scheduler — 会话内定时任务

**做什么：** 在 pi 会话内创建定时/重复任务。适合周期性检查、定时提醒等场景。

**提供的命令：**
- `/loop <interval> <prompt>` — 创建重复任务。如 `/loop 5m 检查部署状态`
- `/remind <time> <prompt>` — 创建一次性提醒。如 `/remind 30m 休息一下`
- `/tasks` — 查看当前活跃任务列表

**提供的工具：** `schedule`
- `create` — 创建任务（interval_ms, prompt, recurring）
- `list` — 列出所有任务
- `cancel` — 取消指定任务（需提供 id）

**也支持无参数 `/loop`** — 会读取项目级 `.pi/loop.md` 或全局 `~/.pi/agent/loop.md` 作为任务定义。

**外部依赖：** 无

---

### 📝 其他

#### journal — 工作日志（开发中）

**做什么：** 汇总每日工作日志——git 活动、记忆变更、会话统计等。

**状态：** 半成品，当前只有类型定义和时间解析库。

**外部依赖：** 无

---

## 共享库

以下库作为扩展的内部依赖存在，不需要单独安装或配置：

| 库 | 说明 |
|----|------|
| **shared-utils** | 路径常量、类型定义、工具函数（被 8 个扩展使用） |
| **workflow-core** | 工作流核心引擎——状态机、Gate 机制、子代理调度 |
| **cartog-manager** | Cartog 索引管理——外部目录软链接、聚合索引、项目级覆盖 |
| **shepherd** | Shepherd 规则引擎核心——规则解析、匹配、动作执行 |

---

## 配置速查

| 配置项 | 文件位置 | 说明 |
|--------|---------|------|
| MCP 服务器 | `~/.pi/agent/extensions/mcp-lite/config.json` | 配置外部 MCP 工具服务器 |
| Shepherd 规则 | `~/.pi/agent/extensions/shepherd/rules.json` | 全局 Hook 规则 |
| Shepherd 规则（项目） | `<project>/.pi/extensions/shepherd-rules-*.json` | 项目级规则叠加 |
| Cartog 索引 | `~/.pi/agent/cartog-index.json` | 全局外部索引目录 |
| Cartog 索引（项目） | `<project>/.pi/cartog-index.json` | 项目级索引覆盖 |
| 记忆（全局） | `~/.pi/agent/memory/*.md` | L1 跨项目知识 |
| 记忆（项目） | `<project>/.pi/memory/*.md` | L2 项目知识 |
| 子代理定义 | `~/.pi/agent/agents/*.md` | 自定义子代理角色 |
| 定时任务模板 | `~/.pi/agent/loop.md` 或 `<project>/.pi/loop.md` | `/loop` 无参数时的默认任务 |
| 模型配置 | `~/.pi/agent/models.json` | API Key 等提供商配置 |
| 停用扩展 | `~/.pi/agent/settings.json` → `extensions.disabled` | 禁用指定扩展 |
| 上下文蒸馏 | `~/.pi/agent/extensions/context/config.json` | 蒸馏阈值、录制开关等 |

---

## 命令速查

| 命令 | 来源扩展 | 说明 |
|------|---------|------|
| `/loop [interval] <prompt>` | scheduler | 创建重复定时任务。如 `/loop 5m 检查部署状态` |
| `/remind <time> <prompt>` | scheduler | 创建一次性提醒。如 `/remind 30m 休息一下` |
| `/tasks` | scheduler | 查看活跃任务列表；`/tasks cancel <id>` 取消指定任务 |
| `/context` | context | 四层 TUI 可视化上下文使用情况（总览→分类→记录→内容） |
| `/record on/off` | context | 开关 payload 录制（开启后 `/tmp/pi-distill/recordings/` 下生成录制文件） |
| `/distill-config [threshold]` | context | 查看或设置 distill token 阈值。如 `/distill-config 1500` |
| `/aging-config [threshold]` | context | 查看或设置 aging 老化轮次。如 `/aging-config 10` 或 `/aging-config off` 关闭 |
| `/processor-config [threshold]` | context | 查看或设置 processor token 阈值。如 `/processor-config 2000` |
| `/mcp-refresh` | mcp-lite | 强制刷新 MCP 工具缓存（重新发现所有 server 的工具） |
| `/mcp-status` | mcp-lite | 查看 MCP 服务器连接状态 |
| `/cartog-reindex` | env-and-status | 重建 Cartog 聚合索引（项目 + 外部目录） |
| `/cartog-config` | env-and-status | 查看当前 Cartog 索引配置和状态 |
| `/cartog-autoindex` | env-and-status | 切换 Cartog 自动索引（启动时是否自动索引） |

---

## 开发

```bash
git clone https://github.com/catlain/pi-atelier.git
cd pi-atelier
npm install

# 验证全部 typecheck
ls extensions/ | while read d; do echo "=== $d ==="; cd "extensions/$d" && npx tsc --noEmit && cd ../..; done
```

## 许可证

MIT
