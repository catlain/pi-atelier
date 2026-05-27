# 4.3 pi-session-analyzer 原理：跨会话搜索

> pi-session-analyzer 是 pi-atelier 的"时光机"——它能搜索和分析所有历史会话，帮你和 AI 回溯过去发生了什么。

## 为什么需要会话分析？

pi 的每次对话都记录在 JSONL 文件中（`~/.pi/agent/distill/` 目录），但原始数据不可读。Session Analyzer 把这些数据变成可搜索、可分析的结构化信息。

三种典型需求：

| 需求 | 解决方式 | 示例 |
|------|----------|------|
| 找到某个会话 | `session_search` 跨会话搜索 | "上次修 DuckDB 的会话是哪个？" |
| 了解会话内容 | `session_analyze` 单会话分析 | "那个会话具体做了什么？" |
| 接手别人的工作 | `takeover` 接手报告 | "接着上次的工作继续" |

## session_search：跨会话搜索

三种搜索模式：

### grep 模式——关键词搜索

搜索所有会话的内容（包括用户消息和 AI 响应）：

```
session_search(action="grep", query="DuckDB 时区")

结果：
  匹配 3 个会话：
  1. 05-22 19:36 — DuckDB 时区配置修复
  2. 05-20 14:30 — 数据库初始化讨论
  3. 05-18 09:15 — 技术选型讨论
```

搜索结果包含上下文片段，不用打开每个会话就能判断是否相关。

**高级用法**：`editOnly=true` 只搜索包含文件编辑操作的会话，过滤掉纯讨论：

```
session_search(action="grep", query="settings.json", editOnly=true)

结果：
  匹配 2 个编辑过 settings.json 的会话
```

这对于追踪

### file 模式——按文件追踪

找到所有修改过某个文件的会话：

```
session_search(action="file", query="src/auth/login.ts")

结果：
  3 个会话修改了此文件：
  1. 05-22 19:36 — 登录 bug 修复（改了空值检查）
  2. 05-20 14:30 — 认证模块重构（改了函数签名）
  3. 05-18 09:15 — 初始创建
```

**使用场景**：代码审查时想知道"这个文件为什么长这样"——每个会话都代表一次修改意图。

### list 模式——浏览最近会话

列出最近的所有会话：

```
session_search(action="list", limit=10)

结果：
  最近 10 个会话：
  1. 05-27 11:24 — 看看我们还剩下些什么事情
  2. 05-27 11:08 — payload 分析脚本能力增强
  3. 05-27 11:06 — roadmap 会话 ID 显示修复
  ...
```

## session_analyze：单会话分析

Session Analyzer 提供多种分析维度，应对不同需求：

> ⚠️ 注意：`session_analyze` 的 `action` 参数只接受以下值，不要传 `grep`/`file`/`list`（那是 `session_search` 的 action）。

### summary——快速了解一个会话

```
session_analyze(action="summary", sessionId="019e6765")

结果：
  会话摘要（31 条对话）
  用户意图：修复 roadmap 会话 ID 显示 bug
  关键操作：发现 formatTimestamps 的 slice(0,8) 截取错误
  产出：2 个 bug fix，145 个测试通过
```

**什么时候用**：不知道一个会话做了什么时，先看 summary。

### entries——逐条事件浏览

支持精确的过滤和分页：

```
# 看最近 10 条
session_analyze(action="entries", limit=10)

# 从第 20 条开始看（分页）
session_analyze(action="entries", offset=20, limit=10)

# 按关键词过滤
session_analyze(action="entries", grep="edit|write")

# Compact 模式——大会话快速浏览
session_analyze(action="entries", compact=true)
```

**什么时候用**：
- 想看 AI 具体执行了什么操作
- 搜索会话中特定类型的操作（如所有文件编辑）
- 大会话快速浏览

### timeline——时间线视图

按时间顺序展示操作流程：

```
session_analyze(action="timeline", sessionId="...")

结果：
  📅 时间线
  [19:36] 👤 DuckDB 查询返回 UTC 时间
  [19:37] 🤖 读取 db/connection.ts
  [19:38] 🤖 发现没有设置时区参数
  [19:39] 🤖 修改 connection.ts
  [19:40] 🤖 运行测试 — 2 个失败
  [19:42] 🤖 修改测试 mock
  [19:43] 🤖 所有测试通过 ✅
```

**什么时候用**：想了解 AI 的操作步骤和决策过程。

### chain——子代理追踪

追踪子代理的调用链：

```
session_analyze(action="chain", sessionId="...")

结果：
  🔗 子代理链
  主代理 → pv-explorer（代码探索）
  主代理 → pv-reviewer（方案审查）
  主代理 → pv-executor（执行变更）
```

**什么时候用**：会话中用了子代理，想知道每个子代理做了什么。

### audit——审计检查

检查会话中是否有违规操作：

```
session_analyze(action="audit", sessionId="...")

结果：
  ⚠️ 发现 2 个问题：
  1. [违规] 直接写 settings.json 而非通过 patchSettingsSectionWithBackup
  2. [警告] 大文件 write 覆盖（>200 行），应拆分
```

**什么时候用**：
- 检查 AI 是否遵守了项目规范
- 审查别人的会话是否有问题
- 定期质量检查

### digest——对话序列

提取会话中的 user/assistant 对话序列，去掉工具调用细节，只保留人类可读的对话：

```
session_analyze(action="digest", sessionId="...")

结果：
  👤 帮我修复 roadmap 显示 bug
  🤖 好的，让我先看看代码...
  👤 测试没通过，看一下
  🤖 发现 formatTimestamps 的截取逻辑有误...
```

**什么时候用**：快速了解会话中用户和 AI 之间的对话脉络，不需要看工具细节。

### raw——原始数据

直接查看 JSONL 原始记录（默认最多 10 条）：

```
session_analyze(action="raw", sessionId="...", limit=5)
```

**什么时候用**：上面的分析模式都不能满足需求时，直接看原始数据。一般用于调试或数据格式确认。

### branches——分支分析

分析 `/tree` 命令产生的平行分支：

```
session_analyze(action="branches", sessionId="...")

结果：
  🌿 分支分析
  [主分支] 正常工作流
  [B1] 尝试用方案 A 重构 → 失败，回到主分支
  [B2] 尝试用方案 B 重构 → 成功
```

**什么时候用**：会话中用了 `/tree` 产生了探索分支，想了解每个分支的结果。

## 数据存储

Session Analyzer 的数据来源：

```
~/.pi/agent/distill/
├── {sessionId}.jsonl          ← 每个会话的完整记录
└── processor/                  ← 工具输出处理缓存
```

会话记录是 JSONL 格式（每行一个 JSON 对象），包含：
- 用户消息
- AI 响应（含工具调用和结果）
- 时间戳
- 分支标记

## 下一步

> 📖 回到 [4.1 让 AI 学会复盘](./review.md) 看完整的使用案例。
