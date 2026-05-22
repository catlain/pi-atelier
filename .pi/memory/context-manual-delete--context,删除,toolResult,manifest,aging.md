# Context 面板：删除 + Aging 展示 + Distill/Aging 调查

关键词：`context` `aging` `distill` `toolResult` `未删除`

## 实现决策（2025-05-22）

### 手动删除机制
- **和 aging 完全一致**：标记 toolCallId，在 context 事件的浅拷贝 messages 上 splice，不修改 pi 原始对话历史
- pi 传入 `[...messages]`（浅拷贝），扩展 splice 后返回，pi 用修改后的版本发送给 LLM
- `manuallyDeletedIds: Set<string>` 持久化到 `manifest.json`（和 distilledMap 共享文件）

### Aging 计数展示
- 踩坑：`setLastContextMessages()` 在 aging 遍历前调用，agingTracker 遍历后被清空
- 修复：新增 `agingSnapshot`，在 aging 遍历后、清理 tracker 前保存快照
- 代码：`shared.ts` agingTracker + agingSnapshot | `collect.ts` 从 snapshot 读取 | `render.ts` 显示 ⏳N

## Distill/Aging 未删除巨型 toolResult 调查（2025-05-22）

### 现象
会话 b2c0-9864943ac996（990+ 轮）中 6 个巨型 toolResult（每个 ~13k tokens，合计 ~77k）50+ 轮都没被删除。

### 已排除
- JSONL 格式正确（`role:"toolResult"`, `toolCallId` 有）
- payload 中 `role:"tool"` 是 provider 适配器后转换的，不影响 aging
- plan-verify 的 `.filter()` 不重新引入已删消息
- `emitContext` → `transformContext` 链路正确

### 未确认的怀疑方向
1. **handler 内部抛异常被静默吞掉**：runner.js try-catch 捕获但 splice 不执行
2. **getContextConfig() 返回异常值**：如 distillThreshold=0
3. **messages 数组引用被替换**：splice 修改不生效

### 调试方案
在 handler 中加日志写 `~/.pi/agent/memory/_aging-debug.log`，需在该会话触发一轮请求后查看。代码已准备好但未提交。
