# 3.3 pi-context-manager 原理：信息质量控制与 Token 诊断

> pi-context-manager 由原 pi-context 和 pi-payload-analyzer 合并而来，统一管理上下文质量和 token 诊断。

## 三个核心能力

### 1. Distill：压缩工具返回的海量信息

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

**Distill 默认自动开启**。有两个关键参数：

| 配置项 | 命令 | 说明 |
|--------|------|------|
| `distillThreshold` | `/distill-config` | 超过此 token 数的工具输出会被压缩 |
| `firstSeenCap` | `/distill-config --cap` | 首次遇到的工具输出上限（0 = 不设上限） |

> 💡 **firstSeenCap 的作用**：有些工具第一次返回结果非常大（比如 `ls` 列出一个大目录），但又不需要保留全部内容。`firstSeenCap` 限制首次输出的最大 token 数，后续请求中如果该结果被 distill 处理会进一步压缩。

### 2. Tool Result Processor：智能格式化精简

Tool Result Processor 对特定工具的输出做结构化精简，比 distill 更精准：

- **Code Graph 输出精简**：自动压缩 AST 搜索结果，保留关键签名和位置
- **MCP JSON 输出精简**：压缩 MCP 工具返回的冗长 JSON
- **错误输出精简**：截断过长的错误堆栈
- **Web 搜索输出精简**：只保留搜索结果的关键信息

通过 `/processor-config` 命令查看或设置处理阈值。

### 3. Aging：老化淘汰旧内容

在长会话中，早期的工具输出可能已经不再相关。Aging 机制自动淘汰"过时"的内容：

```
轮次 1: 工具输出 A（新鲜 🟢）
轮次 5: 工具输出 A（有点旧 🟡）
轮次 10: 工具输出 A（太旧了 🔴 → 自动删除）
```

**Aging 的智能豁免**：某些内容类型不会被老化淘汰，包括：
- 技能文件（SKILL.md）的内容
- 用户手动标记保留的内容
- 最近一次被 AI 引用的内容

通过 `/aging-config` 命令设置淘汰轮数，`/aging-config off` 禁用。

### 4. Payload 分析：用数据诊断上下文问题

会话变长后 AI 变笨？用 `payload_analyze` 找出原因。

> ⚠️ **重要**：`payload_analyze` 是一个 **AI 工具**，不是终端命令。你需要在 pi 的聊天对话中让 AI 来执行它。例如：
>
> ```
> 帮我用 payload_analyze 看一下当前的 token 使用情况
> ```
>
> 或者更精确地指定：
> ```
> 运行 payload_analyze action="budget"
> ```

| 分析模式 | 怎么跟 AI 说 | 看什么 |
|----------|-------------|--------|
| `budget` | "分析一下 token 预算分布" | system/tools/history 各部分的 token 占比 |
| `growth` | "看看 token 增长趋势" | 随会话进行，token 是怎么膨胀的 |
| `expensive` | "找最耗 token 的工具调用" | 最贵的工具调用 Top N |
| `overview` | "详细分析 payload" | 逐消息的详细 token 分析 |
| `messages` | "查看第 5 条消息" | 按索引/范围/关键词精确定位消息 |
| `chain` | "追踪这个工具调用的命运" | 跨 payload 追踪同一个工具调用 |
| `diff` | "对比两个 payload 的差异" | 找出两次请求之间的变化 |
| `stats` | "看 distill/processor 的命中率" | 聚合统计压缩效率 |

> 💡 **先用 budget，再深入**：遇到上下文问题时，先用 `budget` 看整体分布，然后用 `expensive` 定位大户，最后用 `messages` 精确查看某条消息。

## /context TUI 面板

pi-context-manager 还提供了一个 TUI（终端界面）面板，让你可视化浏览上下文内容：

```
/context 命令
     │
     ▼
┌─────────────────────────────────────┐
│  📊 Context Panel                    │
│                                      │
│  [分类] [工具详情] [标记删除]         │
│                                      │
│  ├─ System Prompt    4.2K tokens     │
│  ├─ Tool Definitions 8.1K tokens     │
│  ├─ Memory           2.3K tokens     │
│  ├─ History          52K tokens      │
│  │   ├─ 轮次 1-10  (已标记删除)      │
│  │   ├─ 轮次 11-20                   │
│  │   └─ 轮次 21-30                   │
│  └─ Tool Results     64K tokens      │
│      ├─ read(schema.ts)  8.2K 🔴     │
│      └─ grep("TODO")    4.1K 🟡     │
└─────────────────────────────────────┘
```

在面板中可以：
- **分类浏览**：按类型查看上下文内容
- **工具详情**：查看每个工具返回的完整内容
- **标记删除**：手动标记不需要的内容，下次请求时自动排除

## 完整命令速查

| 命令 | 用途 | 无参行为 |
|------|------|----------|
| `/record [on\|off]` | 开关 payload 录制 | 切换开关 |
| `/context` | 打开 TUI 可视化面板 | — |
| `/distill-config [N]` | 查看/设置 distill 阈值 | 显示当前配置 + 用法 |
| `/distill-config --cap [N]` | 查看/设置 firstSeenCap | 显示当前配置 + 用法 |
| `/processor-config [N\|off]` | 查看/设置 processor 阈值 | 显示当前配置 + 用法 |
| `/aging-config [N\|off]` | 查看/设置 aging 轮数 | 显示当前配置 + 用法 |
| `/context-clean [sessionId]` | 清理持久化数据 | 清理全部 |

## 最佳实践

| 你遇到的问题 | 先做什么 | 再做什么 | 解决方案 |
|------------|---------|---------|---------|
| 会话 30 轮后 AI 变笨 | `payload_analyze(action="growth")` | 看 token 在哪个阶段暴涨 | 调低 distill 阈值 / 装智能压缩 |
| AI 忽略某些文件内容 | 检查 distill 配置 | 可能是 distill 过度压缩 | 调整 `distillThreshold` |
| 每次工具调用特别慢 | `payload_analyze(action="expensive")` | 找出最贵的 Top N 调用 | 限制大文件读取或拆分文件 |
| 旧工具输出占空间 | `/aging-config` 查看 | 设置合适的淘汰轮数 | Aging 自动淘汰 + 手动 `/context` 面板清理 |
| 首次工具输出太大 | `/distill-config --cap` | 设置首次全文上限 | `firstSeenCap` 限制首次输出大小 |

## 下一步

下一章，我们来看如何让 AI 学会**复盘**——自动记录会话事件，随时回溯历史。
