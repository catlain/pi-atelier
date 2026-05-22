# Context 面板：删除 + Aging 展示 + 持久化

关键词：`context` `aging` `distill` `toolResult` `manifest`

## 手动删除机制
- 标记 toolCallId，在 context 事件的浅拷贝 messages 上 splice，不修改 pi 原始对话历史
- `manuallyDeletedIds: Set<string>` 持久化到 `manifest.json`

## Aging 计数展示（⏳N）

### 数据流
1. `index.ts` context 事件 → agingTracker 计数 + setAgingSnapshot
2. `collect.ts` collectData → 从 agingSnapshot 读取 → RecordItem.agingCount
3. `render.ts` renderRecords → 显示 `⏳{agingCount}`

### 三次踩坑（2025-05-22）

#### 坑1：agingTracker 在 collect 时为空
- **原因**：agingTracker 是 index.ts 闭包内的局部变量，collect 无法访问
- **修复**：agingTracker 移到 shared.ts 作为模块级导出

#### 坑2：reload 后 agingSnapshot 为空
- **原因**：agingSnapshot 没有持久化，reload 后重置为空 Map
- **修复**：manifest.json 新增 `aging` 字段，启动时恢复到 agingTracker + agingSnapshot

#### 坑3：所有记录显示 36，但 aging 没删除
- **原因**：达到阈值的 tcId 没有从 agingTracker 清除，每轮 +1 永远 >= threshold，但
  context 事件前两轮（handler 内部）因 emitContext 时序未执行到 aging 逻辑
- **修复**：aging 遍历后，将 count >= agingThreshold 的 tcId 从 tracker 删除
  （它们已被 splice 出 messages，下次不再出现，tracker 保留无意义且会导致值无限累积）

### setAgingSnapshot 保存时机
- **在 aging 遍历和 tracker cleanup 之后**调用（之前放在 cleanup 前会保存即将被删的 stale tcId）
- 持久化到 manifest，reload 后恢复

## Manifest 格式
```json
{
  "distilled": [[tcId, {tmpPath, originalTokens, ...}]],
  "manuallyDeleted": ["tcId1", "tcId2"],
  "aging": [[tcId, count]]
}
```

## Distill/Aging 未删除巨型 toolResult 的根因（已确认）
990+ 轮的长会话中，emitContext 在某些路径下（如 distill 路径）直接 return，
导致 aging 逻辑不执行。修复后 aging 和 distill 路径都正确执行 toRemove + splice。

## 调试日志
- `index.ts` 中 DBG 函数写 `/tmp/pi-context-debug.log`
- `collect.ts` 中有 snapSize/recordsWithAging 日志
- 调试完成后可移除
