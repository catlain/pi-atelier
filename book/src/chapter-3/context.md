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

**Distill 默认是自动开启的**，安装 pi-context-manager 后，大型工具输出会自动被压缩，无需手动配置。

如果需要自定义压缩策略，可以在项目目录的 `.pi/config.json` 中配置：

```json
{
  "context-manager": {
    "distill": {
      "max_output_tokens": 5000,
      "preserve_file_paths": true,
      "compress_json": true,
      "keep_full_lines_for_patterns": [
        "import ",
        "export ",
        "function ",
        "class ",
        "interface ",
        "type "
      ]
    }
  }
}
```

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `max_output_tokens` | 压缩后的最大 token 数 | 5000 |
| `preserve_file_paths` | 是否保留文件路径信息 | true |
| `compress_json` | 是否压缩 JSON 输出 | true |
| `keep_full_lines_for_patterns` | 匹配这些前缀的行完整保留 | `["import ", "export ", ...]` |

> 💡 **前端项目建议**：如果你用 React/Vue，建议在 `keep_full_lines_for_patterns` 中加入 `"export default "` 和 `"const Component"`，确保组件定义不被压缩掉。

### Payload 分析：用数据诊断上下文问题

会话变长后 AI 变笨？用 payload_analyze 找出原因。

> ⚠️ **重要**：`payload_analyze` 是一个 **AI 工具**，不是终端命令。你需要在 pi 的聊天对话中让 AI 来执行它。例如，直接对 AI 说：
>
> ```
> 帮我用 payload_analyze 看一下当前的 token 使用情况
> ```
>
> 或者更精确地指定：
>
> ```
> 运行 payload_analyze action="budget"
> ```

| 分析模式 | 怎么跟 AI 说 | 看什么 |
|----------|-------------|--------|
| `budget` | "分析一下 token 预算分布" | system/tools/history 各部分的 token 占比 |
| `growth` | "看看 token 增长趋势" | 随会话进行，token 是怎么膨胀的 |
| `expensive` | "找最耗 token 的工具调用" | 最贵的工具调用 Top N |
| `overview` | "详细分析 payload" | 逐消息的详细 token 分析 |

**实操：诊断你的第一个长会话**

假设你的会话已经开了 40 轮，AI 开始变笨：

```
第一步：诊断 token 分布
你："帮我用 payload_analyze 分析 token 预算"
AI 调用 payload_analyze(action="budget")

第二步：看结果
如果 Tool Results 占比 > 40% → 工具返回太多内容
如果 Error Output 占比 > 30% → AI 在重复犯错
如果 Conversation 占比 > 50% → 对话本身太长了

第三步：定位问题
"找出最耗 token 的工具调用"
AI 调用 payload_analyze(action="expensive")

第四步：解决问题
→ 安装 pi-smart-compact（见第 5 章）自动压缩历史
→ 调整 distill 配置压缩特定工具的输出
→ 拆分会话（开新会话处理独立任务）
```

> 💡 **鸡生蛋问题**：如果 AI 已经变笨到无法正确执行 payload_analyze，你可以开一个新会话来分析旧会话的录制文件。payload_analyze 支持分析历史录制（`action="list"` 列出所有录制文件）。

## 最佳实践

| 你遇到的问题 | 先做什么 | 再做什么 | 解决方案 |
|------------|---------|---------|---------|
| 会话 30 轮后 AI 变笨 | `payload_analyze(action="growth")` | 看 token 在哪个阶段暴涨 | 调低 distill 阈值 / 装智能压缩 |
| AI 忽略某些文件内容 | 检查 distill 配置 | 可能是 distill 过度压缩 | 在 `keep_full_lines_for_patterns` 中白名单关键文件 |
| 每次工具调用特别慢 | `payload_analyze(action="expensive")` | 找出最贵的 Top N 调用 | 限制大文件读取或拆分文件 |

## 下一步

下一章，我们来看如何让 AI 学会**复盘**——自动记录会话事件，随时回溯历史。
