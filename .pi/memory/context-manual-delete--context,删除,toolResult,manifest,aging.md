# Context 面板：删除 + Aging 展示

关键词：`context` `aging` `distill` `toolResult` `manifest`

## 手动删除机制
- 标记 toolCallId，在 context 事件的浅拷贝 messages 上 splice，不修改 pi 原始对话历史
- `manuallyDeletedIds: Set<string>` 持久化到 `manifest.json`

## Aging 计数展示（⏳N）

### 数据流
1. `index.ts` context 事件 → agingTracker 计数 + setAgingSnapshot
2. `collect.ts` collectData → 从 agingSnapshot 读取 → RecordItem.agingCount
3. `render.ts` renderRecords → 显示 `⏳{agingCount}`

### 踩坑记录（2025-05-22）

#### 坑1：agingTracker 闭包变量无法跨模块访问
- **修复**：agingTracker 移到 shared.ts 作为 `export const` 模块级导出

#### 坑2：`export let` 在 jiti/CJS 下 live binding 失效
- **现象**：index.ts 写 agingSnapshot，collect.ts 读到的是初始值
- **根因**：jiti 编译为 CJS，`let` 重新赋值只改局部变量，不更新 exports
- **修复**：改用 `export const agingSnapshot = new Map()` + `clear()/set()` 操作同一对象

#### 坑3：达到阈值的 tcId 未从 agingTracker 清除，值无限累积
- **修复**：aging 遍历中记录 `agingRemovedTcIds`，遍历后从 tracker 删除

#### 坑4：多 pi 进程共享 manifest 导致 aging 数据互相覆盖
- **现象**：进程 A 写入 300 条 aging，进程 B 触发 context 事件时 `setAgingSnapshot` 把 manifest 清空
- **修复**：**aging 不持久化到 manifest**。它是短暂运行时状态，reload 后从 0 重新计数

### Manifest 格式（aging 已移除）
```json
{
  "distilled": [[tcId, {tmpPath, originalTokens, ...}]],
  "manuallyDeleted": ["tcId1", "tcId2"]
}
```

### 关键约束
- **禁止 `export let` + 重新赋值**：必须用 `export const` + 操作同一对象引用
- **aging 不持久化**：避免多进程竞争
- **调试日志**：DBG 函数写 `/tmp/pi-context-debug.log`，按 `[PID]` 区分进程
