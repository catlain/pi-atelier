# Context 面板：删除 + Aging 展示

关键词：`context` `删除` `toolResult` `manifest` `aging` `agingSnapshot`

## 实现决策（2025-05-22）

### 机制
- **和 aging 完全一致**：标记 toolCallId，在 context 事件的浅拷贝 messages 上 splice，不修改 pi 原始对话历史
- pi 传入 `[...messages]`（浅拷贝），扩展 splice 后返回，pi 用修改后的版本发送给 LLM

### 持久化
- `manuallyDeletedIds: Set<string>` 持久化到 `manifest.json`（和 distilledMap 共享文件）
- manifest 格式：`{ distilledMap: {...}, manuallyDeleted: [...] }`
- 启动时从 manifest 恢复，每次修改后保存

### UI 交互
- content 层（Level 3）按 `d` → 确认状态（y/n）→ 加入集合 → 自动返回 records 层
- records 层已删除项显示 `[deleted]` 标记

### 清理
- 每轮 context 事件后调用 `cleanupDeletedIds()`，移除 messages 中已不存在的 tcId
- 防止集合无限增长

## Aging 计数展示（2025-05-22）

### 需求
在 Level 2 记录列表中显示每条工具结果已被发送给 LLM 多少次，结合 aging 阈值判断即将被遗忘的内容。

### 踩坑：agingTracker 时序问题
- **根因**：`setLastContextMessages()` 在 aging 遍历 **之前** 调用，agingTracker 在遍历结束后被清理（删除不在 messages 中的 tcId）
- collect 在面板打开时执行，读到的 agingTracker 已被清空 → `trackerSize=0`
- **修复**：新增 `agingSnapshot`，在 aging 遍历后、清理 tracker 前保存快照，collect 从快照读取

### 数据流
```
context 事件 → aging 遍历（更新 agingTracker）
            → setAgingSnapshot(agingTracker)  // 快照
            → 清理 agingTracker（删除不存在的 tcId）
面板打开   → collect 从 agingSnapshot 读取 → render 显示 ⏳N
```

### 代码位置
- `extensions/context/shared.ts` — agingTracker + agingSnapshot + manuallyDeletedIds
- `extensions/context/index.ts` — context 事件：aging 遍历 + 快照保存 + 清理
- `extensions/context/collect.ts` — RecordItem.agingCount 从 agingSnapshot 读取
- `extensions/context/render.ts` — Level 2 显示 ⏳N 标签
- `extensions/context/types.ts` — RecordItem.agingCount?: number
- `extensions/context/context.ts` — UI 交互
