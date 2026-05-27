# 5.3 用 pi-context-manager 诊断 Token 消耗

> pi-payload-analyzer 的功能已合并到 pi-context-manager 中。本节介绍如何使用统一的 `payload_analyze` 工具诊断上下文问题。

## Token 都花在哪了？

长会话中 AI 变笨，往往是因为上下文被"垃圾"填满了。但具体是哪些内容占了 token？靠猜是不行的。

pi-context-manager 提供了 `payload_analyze` 工具，用**数据**告诉你 token 的去向。

## 需要先开启录制

`payload_analyze` 需要先录制 payload 才能分析。在对话中输入：

```
/record on
```

录制会保存在 `~/.pi/agent/distill/recordings/` 目录下。录制期间会有轻微的性能开销，用完记得 `/record off` 关闭。

## 分析模式速查

### 全局概览类

| 模式 | 用途 | 输出 |
|------|------|------|
| `list` | 列出所有录制文件 | 文件列表 + 大小 |
| `budget` | Token 预算分析 | system/tools/history 各部分占比 |
| `growth` | 增长趋势 | token 随请求变化的曲线 |
| `stats` | 聚合统计 | distill/processor 命中率、压缩效率 |

### 深入诊断类

| 模式 | 用途 | 输出 |
|------|------|------|
| `expensive` | 最贵的工具调用 | 按 token 排序的 Top N |
| `overview` | 逐消息详细分析 | 每条消息的 token 构成 + distill 事件 |
| `messages` | 精确定位消息 | 按索引/范围/关键词过滤 |

### 追踪对比类

| 模式 | 用途 | 输出 |
|------|------|------|
| `chain` | 追踪工具调用命运 | 同一个 argsSig 跨 payload 的变化 |
| `chain-tcid` | 追踪 toolCallId | 验证 distill 行为 |
| `diff` | 对比两个 payload | 找出两次请求的差异 |
| `single` | 分析单个文件 | 单个录制文件的完整分析 |

### messages 模式的精确定位

`messages` 是最灵活的诊断工具，支持多种过滤方式：

```
# 看第 5 条消息（0-based）
payload_analyze(action="messages", msgIndex=5)

# 看第 5-10 条消息
payload_analyze(action="messages", msgRange="5-10")

# 看最后 5 条消息
payload_analyze(action="messages", msgRange="last:5")

# 按关键词过滤
payload_analyze(action="messages", grep="error|fail")

# 按工具名过滤
payload_analyze(action="messages", toolName="read")
```

## 实战案例

### 案例 1：找出上下文膨胀的根因

```
第一步：budget 模式看总量
你："帮我用 payload_analyze 分析 token 预算"
结果：Tool Results 占 49.5%

第二步：expensive 模式找大户
你："找出最耗 token 的工具调用 Top 10"
结果：read(schema.ts) 占 8.2K tokens

第三步：优化
→ 用 offset/limit 分块读取大文件
→ 或者启用 distill 自动压缩
```

### 案例 2：诊断压缩效率

```
第一步：stats 模式看命中率
你："看 distill 和 processor 的压缩效率"
结果：distill 命中率 75%，processor 命中率 60%

第二步：chain 模式追踪
你："追踪 read(schema.ts) 的 distill 行为"
结果：第 3 次请求被 distill，从 8.2K 压缩到 1.5K
```

### 案例 3：对比两次请求的差异

```
你："对比这两个 payload 有什么不同"
AI 调用 payload_analyze(action="diff", payloadPath="...", payloadPath2="...")
结果：第二次请求多了 3 条工具调用，但 distill 压缩了 2 条
```

> 📖 完整长会话诊断案例见 [5.1 长会话生存指南](./long-session.md)
