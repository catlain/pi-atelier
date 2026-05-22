# Context 面板手动删除功能

关键词：`context` `删除` `toolResult` `manifest` `aging`

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

### 代码位置
- `extensions/context/shared.ts` — 集合定义 + 持久化
- `extensions/context/index.ts` — context 事件第三轮过滤
- `extensions/context/context.ts` — UI 交互
- `extensions/context/collect.ts` — RecordItem 关联 toolCallId + 标记
- `extensions/context/render.ts` — footer 提示 + deleted 标记
- `extensions/context/types.ts` — RecordItem 类型扩展
