# 5.3 用 pi-context-manager 诊断 Token 消耗

> pi-payload-analyzer 的功能已合并到 pi-context-manager 中。本节介绍如何使用统一的 `payload_analyze` 工具诊断上下文问题。

## Token 都花在哪了？

长会话中 AI 变笨，往往是因为上下文被"垃圾"填满了。但具体是哪些内容占了 token？靠猜是不行的。

pi-context-manager 提供了 `payload_analyze` 工具，用**数据**告诉你 token 的去向。

## 四种分析模式

### 1. budget — Token 预算分析

看 system prompt、工具定义、历史消息各占多少 token：

```
请求发给 AI 时的 payload 构成
┌──────────────────────────────┐
│ system prompt (12%)          │ ← 你能控制：精简 AGENTS.md
│ tools 定义 (18%)             │ ← 你能控制：少装不需要的扩展
│ 历史消息 (65%)               │ ← 这是膨胀的主因！
│ 当前消息 (5%)                │
└──────────────────────────────┘
```

### 2. growth — 增长趋势

画出 token 随会话轮次的变化曲线，帮你看到"哪一轮开始爆炸"。

### 3. expensive — 最贵的调用

按 token 排序，列出最耗资源的工具调用。通常是读取大文件、搜索结果过多等。

### 4. overview — 逐消息分析

每条消息的详细 token 构成，用于精确诊断。

## 实战案例

> 📖 完整案例见 [5.4 动手诊断](./long-session.md)
