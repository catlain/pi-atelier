# 让 AI 学会复盘

## 你可能遇到过这种情况

你开了一个 3 小时的会话，AI 帮你做了很多事：

- 修了两个 bug
- 重构了一个模块
- 配置了 CI 流水线
- 写了一堆测试

第二天你想回顾一下："昨天那个登录 bug 具体是怎么修的？"但你只有模糊的记忆——是改了 `auth.ts` 还是 `middleware.ts`？是加了空值检查还是改了类型断言？

你翻遍了 git log，commit message 写的是"fix: update auth"——等于没写。

> 💡 **AI 做了很多事，但没有人记录"为什么这样做"**。git 只记了改了什么，没记思考过程。

## 两件工具：Journal 和 Session Analyzer

pi-atelier 提供了两个互补的工具来解决这个问题：

### pi-journal — 自动记录

Journal（日志）在后台默默记录每个会话的关键事件：

- 哪些文件被读取了
- 哪些文件被修改了
- AI 做了哪些关键决策
- 会话的起止时间

```
┌─────────────────────────────────────┐
│           AI 会话进行中               │
│                                      │
│  读取 src/auth.ts    → Journal 记录  │
│  修改 src/auth.ts    → Journal 记录  │
│  运行 npm test       → Journal 记录  │
│  提交 git commit     → Journal 记录  │
│                                      │
│  会话结束 → 生成当日摘要              │
└─────────────────────────────────────┘
```

### pi-session-analyzer — 深度回溯

Session Analyzer（会话分析器）让你搜索和分析历史会话：

| 功能 | 说明 |
|------|------|
| 跨会话搜索 | 关键词搜索所有历史会话的内容 |
| 按文件搜索 | 找到所有修改过某个文件的会话 |
| 时间线视图 | 按时间顺序查看一个会话的完整过程 |
| 摘要生成 | 自动总结一个会话做了什么 |
| 分支分析 | 分析 `/tree` 产生的平行分支 |

## 实际案例：找到上周的 bug 修复

### 场景：跨会话搜索

你说："帮我找一下上次修 DuckDB 时区问题的会话。"

AI 调用 `session_search`：

```
🔍 搜索 "DuckDB 时区" — 找到 2 个匹配会话：

1. 05-22 19:36 — DuckDB 时区配置修复
   改了 src/db/connection.ts
   
2. 05-20 14:30 — 数据库初始化讨论
   讨论了时区策略但没改代码
```

### 场景：查看会话详情

你说："看看第一个会话的详细过程。"

AI 调用 `session_analyze`，生成时间线：

```
📅 会话时间线（05-22 19:36）

[19:36] 用户：DuckDB 查询返回 UTC 时间，需要改成中国时区
[19:37] AI：读取 db/connection.ts
[19:38] AI：发现连接时没有设置时区参数
[19:39] AI：修改 connection.ts，添加 SET timezone = 'Asia/Shanghai'
[19:40] AI：运行测试，2 个测试失败
[19:41] AI：发现测试用的 mock 没有时区设置
[19:42] AI：修改测试 mock
[19:43] AI：所有测试通过 ✅
[19:44] AI：提交 git commit "fix: set DuckDB timezone to Asia/Shanghai"
```

### 场景：按文件追踪

你说："connection.ts 最近被谁改过？"

AI 调用 `session_search` 的 `file` 模式：

```
📄 src/db/connection.ts 的修改历史：

1. 05-22 19:36 — DuckDB 时区修复（你）
2. 05-20 14:30 — 数据库连接池配置（同事）
3. 05-18 09:15 — 初始创建（你）
```

## Journal 的输出格式

Journal 生成的日志存储在 `.pi/journal/` 目录下：

```
.pi/journal/
├── 2026-05-22.md        # 当日日志
├── 2026-05-21.md
└── summaries/
    ├── weekly-2026-W21.md  # 周总结
    └── daily/              # 每日摘要
```

每日日志的内容示例：

```markdown
# 2026-05-22 工作日志

## 会话 1：DuckDB 时区修复（19:36 - 19:44）

- 修改：src/db/connection.ts
- 修改：tests/db/connection.test.ts
- 决策：在连接层设置时区，不在 SQL 层
- 测试：全部通过

## 会话 2：API 文档编写（20:15 - 21:30）

- 创建：docs/api/auth.md
- 创建：docs/api/users.md
- 修改：docs/api/index.md
```

## Session Analyzer 的分析维度

| 模式 | 用途 | 命令示例 |
|------|------|----------|
| `summary` | 会话概览 | "这个会话做了什么" |
| `entries` | 逐条事件 | "列出所有文件修改" |
| `timeline` | 时间线 | "AI 的操作顺序是什么" |
| `chain` | 子代理追踪 | "子代理做了什么" |
| `audit` | 审计检查 | "有没有违规操作" |
| `digest` | 对话序列 | "我和 AI 聊了什么" |
| `takeover` | 接手报告 | "帮我接手上次的工作" |

### 最有用的模式：takeover

`takeover` 生成一份"接手报告"，包含 5 个维度：

```
📋 会话接手报告

1. 用户意图：修复 DuckDB 时区问题
2. 修改文件：connection.ts, connection.test.ts
3. 最近步骤：修改了测试 mock，测试通过
4. 下一步：考虑是否需要在文档中说明时区行为
5. 关键决策：选择在连接层而非 SQL 层处理时区
```

当你想"接着上次的工作继续"时，这个报告能帮你（或者另一个 AI）快速恢复上下文。

## 最佳实践

### ✅ 让 Journal 发挥最大价值

- **频繁提交**：AI 在 Journal 中记录的事件粒度跟 git commit 一致
- **定期回顾**：每周用 `session_search` 回顾本周做了什么
- **结合记忆**：Journal 记录"做了什么"，Memory 记录"学到了什么"

### ✅ Session Analyzer 的高效用法

- **`grep` 模式**：跨所有会话搜索关键词（比翻 git log 快得多）
- **`file` 模式**：找到所有动过某个文件的会话（代码审查利器）
- **`takeover` 模式**：接手别人的工作时，先生成接手报告

### ❌ 常见误区

- 不要把 Journal 当 Memory 用——Journal 是日志（发生了什么），Memory 是知识（学到了什么）
- 不要在 Journal 里找代码内容——Journal 只记录操作，不记录代码全文

## 下一步

有了复盘能力，AI 和你都能回顾过去的工作。但还有一个问题：会话越长，AI 越容易"变笨"——开始重复自己、忘记前面的约定。

下一章，我们来看如何让 AI 在长会话中保持聪明。
