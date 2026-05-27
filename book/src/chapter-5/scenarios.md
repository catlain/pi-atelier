# 5.4 长会话实战场景

> 这一节通过真实使用场景，展示如何组合 pi-atelier 的工具解决长会话中的常见问题。

## 场景 1：AI 变笨了——用 Smart Compact 压缩

### 症状

你跟 AI 已经聊了 2 个小时，做了很多事。突然发现 AI 开始：
- 问你之前已经回答过的问题
- 重新提出已经被否决的方案
- 代码质量明显下降——少了错误处理

### 传统压缩 vs Smart Compact

pi 内置的 Compaction 会在上下文接近上限时自动触发，但它只是简单地压缩旧对话为一段通用摘要。Smart Compact 更聪明：

```
传统 Compaction：
  100 轮对话 → 一段 500 字的通用摘要
  问题：关键细节丢失，AI 不知道之前做了什么决定

Smart Compact（两阶段）：
  Phase 1（意图总结）：
    → 提取：决策、约定、文件修改、结论
    → 保留所有关键信息，丢弃冗余过程
  
  Phase 2（工具去留）：
    → 逐批判断每个工具结果是否需要保留
    → 丢弃：重复读取、失败尝试、调试过程
```

### 操作步骤

```
1. AI 已经帮你做了很多事，你感觉上下文快满了
2. 输入 /smart-compact
3. Smart Compact 分析对话历史，生成增强摘要
4. AI 继续工作，但"记得"所有关键决策
```

或者什么都不做——如果配置了 `auto` 模式（默认），Smart Compact 会在合适的时机自动触发。

### 配合 Context Manager 效果更好

Smart Compact 压缩**对话历史**，Context Manager 的 Distill 压缩**工具返回结果**。两个配合使用：

```
上下文窗口
├── 对话历史 ←── Smart Compact 压缩（保留决策和结论）
├── 工具结果 ←── Distill 压缩（保留关键信息，丢弃冗余）
└── 记忆注入 ←── 固定大小，不变
```

## 场景 2：上下文已经炸了——Handoff 接手

### 症状

更极端的情况：AI 报错了——"上下文窗口超出限制"（context window exceeded）。整个会话已经无法继续。

这时候光压缩已经来不及了——会话直接崩溃。

### 解决方案：开新会话 + takeover 接手

```
1. 开一个新会话
2. 告诉 AI："帮我接手上次的工作"
3. AI 调用 session_analyze(action="takeover")
4. 生成 5 维度接手报告：

📋 会话接手报告

1. 用户意图：重构认证模块，从 JWT 切换到 session-based
2. 修改文件：
   - src/auth/middleware.ts（已改完）
   - src/auth/login.ts（进行中，80% 完成）
   - src/auth/__tests__/login.test.ts（待写）
3. 最近步骤：
   - 修改了 middleware.ts 的类型签名
   - 开始改 login.ts 但还没改完
   - 测试还没写
4. 下一步：
   - 完成 login.ts 的修改
   - 写 login.test.ts 的测试
   - 跑一遍全量测试
5. 关键决策：
   - 选择 session-based 而非 refresh token 方案
   - 原因：项目不需要跨域 SSO
```

### takeover 的 5 个维度

| 维度 | 包含什么 | 为什么重要 |
|------|----------|-----------|
| 用户意图 | 原始需求和目标 | 新 AI 知道"要做什么" |
| 修改文件 | 已改和待改的文件列表 | 知道"改了什么" |
| 最近步骤 | 最近 3-5 步操作 | 知道"进行到哪了" |
| 下一步 | 还需要做什么 | 知道"接下来该做什么" |
| 关键决策 | 重要的技术选择和理由 | 知道"为什么这样做" |

有了这 5 个维度，新会话的 AI 可以在 1-2 轮对话内完全恢复工作上下文。

### 操作示例

```
你：帮我接手上次修 Godot MCP Bridge 的工作

AI：
  🛠 session_analyze(action="takeover", sessionId="019e620f-...")
  
  📋 接手报告已生成。上次你在调试 MCP Bridge 的 WebSocket 连接问题，
  已经定位到 nohup 导致 listen() 返回值被吞。下一步是不用 nohup 
  直接启动 TCP 端口。要我继续吗？
```

## 场景 3：想了解过去发生了什么——会话分析

### 症状

你昨天让 AI 做了一大堆事。今天你想回顾："昨天那个 DuckDB 时区 bug 具体是怎么修的？"

### 操作步骤

```
第一步：跨会话搜索
你：搜一下之前修 DuckDB 时区的会话

AI：
  🛠 session_search(action="grep", query="DuckDB 时区")
  
  找到 2 个匹配会话：
  1. 05-22 19:36 — DuckDB 时区配置修复
  2. 05-20 14:30 — 数据库初始化讨论

第二步：看时间线
你：看看第一个的详细过程

AI：
  🛠 session_analyze(action="timeline", sessionId="...")
  
  📅 时间线：
  [19:36] 用户：DuckDB 查询返回 UTC 时间
  [19:37] AI：读取 db/connection.ts
  [19:38] AI：发现没有设置时区参数
  [19:39] AI：添加 SET timezone = 'Asia/Shanghai'
  [19:43] AI：所有测试通过 ✅

第三步：看对话原文（如果需要更多细节）
你：看看 19:39 前后的对话原文

AI：
  🛠 session_analyze(action="entries", msgRange="5-10", sessionId="...")
```

### 常用的分析模式组合

```
快速了解一个会话：summary → 知道做了什么
追踪操作顺序：   timeline → 知道步骤
查看对话原文：   entries  → 知道细节
接手别人的工作： takeover → 知道上下文
检查是否有违规： audit    → 知道有没有问题
```

## 场景 4：工具输出占满了上下文——Aging 自动遗忘

### 症状

AI 在一个会话中用了大量工具：读了 20 个文件、跑了 10 次搜索、执行了 5 次 bash 命令。每个工具返回的结果都留在上下文里。

问题是：你只需要**最近的几个**结果。20 分钟前 `read` 的那个文件，现在早就不需要了。

### 解决方案：Aging 自动淘汰

Aging（老化淘汰）会在指定轮数后自动淘汰未被再次引用的工具输出：

```
时间线：
  第 1 轮：read(auth.ts) → 5K tokens
  第 2 轮：read(middleware.ts) → 4K tokens
  第 3 轮：grep("TODO") → 3K tokens
  ...
  第 10 轮：edit(auth.ts)  ← auth.ts 又被引用，"续命"成功
  
  第 1+8=9 轮：grep("TODO") → 8 轮没被引用，自动淘汰 ✅
  第 2+8=10 轮：middleware.ts 没被再次引用，自动淘汰 ✅
  第 1+8=9 轮：auth.ts → 被 edit 引用，保留！
```

### 配置 Aging

```
/aging-config 8    # 8 轮后淘汰（推荐 8-12）
/aging-config off  # 关闭自动淘汰
```

> 💡 **技能文件豁免**：SKILL.md 的内容不会被 aging 淘汰——AI 始终能看到当前加载的技能。

### 手动干预：/context TUI 面板

如果不想等自动淘汰，可以手动标记删除：

```
1. 输入 /context 打开 TUI 面板
2. 分类浏览：按工具类型、时间顺序查看所有上下文内容
3. 选中不需要的内容，标记为删除
4. 下次 AI 发送请求时，标记的内容不会带上
```

这在以下场景特别有用：
- AI 读了一个巨大的配置文件但你只需要其中一行
- 搜索返回了 50 条结果但你只用了 3 条
- 之前调试时的错误信息已经不需要了

## 场景 5：为什么 AI 变慢了——Token 预算诊断

### 症状

AI 的响应越来越慢，而且每轮对话的等待时间明显变长。你怀疑是上下文太大了，但不知道具体是什么在占空间。

### 操作步骤

```
第一步：开启录制
你：/record on

... 多做几轮对话 ...

第二步：看 token 预算
你：帮我分析 token 预算

AI：
  🛠 payload_analyze(action="budget")
  
  📊 Token 预算分析
  System Prompt:    4,200 (3.2%)
  Tool Definitions: 8,100 (6.2%)
  Memory Injection: 2,300 (1.8%)
  Conversation:    52,400 (40.0%)
  Tool Results:    64,800 (49.5%)  ← 大头在这！
  
第三步：找最贵的调用
你：找出最耗 token 的工具调用

AI：
  🛠 payload_analyze(action="expensive", topN=5)
  
  Top 5 最贵的工具调用：
  1. read(src/database/schema.ts)  — 8,200 tokens
  2. code_graph_module_overview    — 6,400 tokens
  3. grep("TODO|FIXME")           — 4,100 tokens
  4. read(src/config/settings.ts) — 3,800 tokens
  5. bash("npm test")             — 3,200 tokens

第四步：针对性优化
→ schema.ts 太大，用 offset/limit 只读需要的部分
→ code_graph 用 compact=true 模式
→ grep 加 --include 限定文件类型
```

### 诊断流程速查

```
1. budget  → 看总量分布（哪部分占比最高？）
2. expensive → 找大户（具体哪个调用最耗 token？）
3. growth  → 看趋势（哪段时间增长最快？）
4. messages → 精确定位（看看那条具体的消息内容）
5. 针对性优化（换工具、加过滤、启用 distill）
```

## 场景组合：超长会话的完整生存策略

```
会话开始
│
├── 第 1-20 轮：正常工作，不用操心
│
├── 第 20-40 轮：上下文使用率 ~40%
│   → 开启 /record on（可选，为后续诊断做准备）
│   → 注意避免重复读取大文件
│
├── 第 40-60 轮：上下文开始紧张
│   → Smart Compact 接管 pi 的压缩事件（如果 auto 模式开启）
│   → 或手动 /smart-compact
│   → Aging 开始淘汰旧工具输出
│
├── 第 60-80 轮：接近上限
│   → Smart Compact 已完成两阶段压缩
│   → 考虑是否该开新会话了
│   → 如果要继续：用 payload_analyze budget 检查
│
├── 💥 崩溃了！
│   → 开新会话
│   → session_analyze(action="takeover") 接手
│   → 继续工作
│
└── 收工前：
    → /record off
    → 让 AI 用 /journal 生成日报
    → agent_end 自动提醒 commit + 记忆更新
```

> 📖 回到 [5.1 长会话生存指南](./long-session.md) 看完整的工具介绍。
