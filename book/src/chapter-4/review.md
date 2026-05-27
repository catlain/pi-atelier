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

## 核心工具：pi-session-analyzer

pi-atelier 提供了 Session Analyzer（会话分析器）来搜索和分析历史会话：

| 功能 | 说明 |
|------|------|
| 跨会话搜索 | 关键词搜索所有历史会话的内容 |
| 按文件搜索 | 找到所有修改过某个文件的会话 |
| 时间线视图 | 按时间顺序查看一个会话的完整过程 |
| 摘要生成 | 自动总结一个会话做了什么 |
| 分支分析 | 分析 `/tree` 产生的平行分支 |
| 接手报告 | 5 维度上下文，帮 AI 快速恢复工作 |
| 审计检查 | 检查会话中是否有违规操作 |

> 💡 **关于 pi-journal**：pi-journal 可以通过 `/journal` 命令或 `journal` 工具生成日报/周报，采集 git 活动、记忆变更、会话活动三路数据。详见 [4.2 pi-journal 原理](./journal.md)。

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

## Session Analyzer 的 compact 模式

`entries` 动作支持 `compact` 参数，精简输出适合快速浏览大会话：

```
# 标准模式
session_analyze(action="entries")
→ 完整的每条记录（含时间戳、类型、完整内容）

# Compact 模式
session_analyze(action="entries", compact=true)
→ 去掉 type 列、时间只保留 HH:MM、预览 60 字符
→ 适合 100+ 条记录的大会话
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

### ✅ Session Analyzer 的高效用法

- **`grep` 模式**：跨所有会话搜索关键词（比翻 git log 快得多）
- **`file` 模式**：找到所有动过某个文件的会话（代码审查利器）
- **`takeover` 模式**：接手别人的工作时，先生成接手报告
- **`compact` 模式**：大会话快速浏览，精简输出
- **`audit` 模式**：定期检查 AI 是否有违规操作

### ❌ 常见误区

- 不要用 `session_search` 代替记忆——搜索是回溯（过去做了什么），记忆是知识（学到了什么）
- 不要期望找到代码全文——会话记录是摘要，不是完整备份

## 下一步

有了复盘能力，AI 和你都能回顾过去的工作。但还有一个问题：会话越长，AI 越容易"变笨"——开始重复自己、忘记前面的约定。

下一章，我们来看如何让 AI 在长会话中保持聪明。
