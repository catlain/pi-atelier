# 5.2 pi-smart-compact 原理：两阶段增强压缩

> Smart Compact 是 pi 内置 Compaction 机制的增强版——它不是简单地截断历史，而是"聪明地"决定保留什么、丢弃什么。

## 为什么需要增强压缩？

pi 内置的 Compaction 会在上下文接近上限时自动压缩旧对话，但它不够"聪明"：

```
内置 Compaction：
  压缩前 100 轮对话 → 压缩后生成一段通用摘要
  问题：摘要太粗糙，关键细节丢失，工具调用结果被无差别截断
```

Smart Compact 的改进——**接管 pi 的压缩事件**，执行两阶段增强压缩：

| 阶段 | 做什么 | 怎么做 |
|------|--------|--------|
| Phase 1：意图总结 | 提取用户意图、关键决策、当前状态 | 遍历对话，提取 AI 回复中的非工具文本，生成结构化意图摘要 |
| Phase 2：工具去留 | 判断哪些工具调用结果可以安全丢弃 | 将所有工具调用配对（调用+结果），让 LLM 逐批判断保留/丢弃 |

```
pi 触发 compact 事件
  → Smart Compact 接管（如果 auto 模式开启）
    → Phase 1：提取意图摘要（保留决策、约定、结论）
    → Phase 2：逐批判断工具结果去留
  → 输出精简后的对话历史，替代 pi 默认的粗糙摘要
```

两个阶段是**一次性顺序执行**的——Smart Compact 接管压缩事件后，先做意图总结，再做工具筛选，最后输出精简结果。不是按上下文使用率分阶段触发。

## 配置

### 安装

```json
{
  "packages": ["pi-smart-compact"]
}
```

### 命令

| 命令 | 用途 |
|------|------|
| `/smart-compact` | 手动触发两阶段压缩 |
| `/smart-compact-config [auto\|manual]` | 查看或切换自动/手动模式 |

### 自动/手动模式

- **`auto`**（默认）：pi 触发 compact 事件时自动接管，执行增强压缩
- **`manual`**：只在用户执行 `/smart-compact` 时触发

### 高级配置

在 `~/.pi/agent/settings.json` 中可配置：

```json
{
  "smart-compact": {
    "enabled": true,
    "intentModel": "",
    "filterModel": "",
    "thinkingTruncateChars": 500,
    "toolCallTruncateChars": 2000,
    "toolResultTruncateChars": 5000,
    "filterBatchSize": 10
  }
}
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `intentModel` | 空（用会话默认模型） | Phase 1 意图总结使用的模型 |
| `filterModel` | 空（用会话默认模型） | Phase 2 工具去留判断使用的模型 |
| `thinkingTruncateChars` | 500 | thinking 块截断字符数 |
| `toolCallTruncateChars` | 2000 | toolCall arguments 截断字符数 |
| `toolResultTruncateChars` | 5000 | toolResult 内容截断字符数 |
| `filterBatchSize` | 10 | Phase 2 每批判断的工具数量 |

## 压缩保留什么？

Smart Compact 的 Phase 2 会根据以下优先级判断工具结果：

| 优先级 | 内容类型 | 为什么保留 |
|--------|----------|-----------|
| 🔴 最高 | 用户明确的要求和约束 | 这是任务目标 |
| 🟠 高 | 关键决策和选择理由 | 避免 AI 重复讨论已否决的方案 |
| 🟡 中 | 文件修改记录（edit/write） | 让 AI 知道哪些文件已改过 |
| 🟢 低 | 文件读取和搜索结果 | 可以重新执行 |
| ⚪ 最低 | 失败的尝试和调试过程 | 已经学到了教训 |

## 最佳实践

- **长会话时开启 auto 模式**：Smart Compact 会在 pi 准备压缩时自动接管，比默认压缩保留更多关键信息
- **手动触发适合关键操作前**：在开始一个重要的重构之前，手动 `/smart-compact` 清理上下文
- **配合 context-manager**：Smart Compact 压缩对话历史，Context Manager 的 distill 压缩工具输出，两者互补
- **可用便宜模型做压缩**：如果不想浪费主模型的 token，可以在配置中指定 `filterModel` 为更便宜的模型

> 📖 回到 [5.1 长会话生存指南](./long-session.md) 看完整的诊断和优化案例。
