# 3.3 pi-context-manager 原理：信息质量控制与 Token 诊断

> pi-context-manager 由原 pi-context 和 pi-payload-analyzer 合并而来，统一管理上下文质量。

## 两个核心能力

### Distill：压缩工具返回的海量信息

当工具返回大量内容（比如读取一个 1000 行的文件），pi-context-manager 会自动压缩，只保留关键信息：

```
原始工具输出（50KB）
     │
     ▼
┌────────────────────────┐
│   Distill 处理器        │
│   提取关键行 + 摘要      │
└────────────────────────┘
     │
     ▼
压缩后输出（~5KB）
     │
     ▼
AI 看到精炼后的信息
```

### Payload 分析：用数据诊断上下文问题

会话变长后 AI 变笨？用 payload_analyze 找出原因：

| 分析模式 | 命令 | 看什么 |
|----------|------|--------|
| `budget` | `payload_analyze(action="budget")` | system/tools/history 各部分的 token 占比 |
| `growth` | `payload_analyze(action="growth")` | 随会话进行，token 是怎么膨胀的 |
| `expensive` | `payload_analyze(action="expensive")` | 最耗 token 的工具调用 Top N |
| `overview` | `payload_analyze(action="overview")` | 逐消息的详细 token 分析 |

> 💡 **典型用法**：先用 `growth` 看膨胀趋势，再用 `expensive` 找到最贵的调用，最后优化对应的工具或配置 distill 策略。
