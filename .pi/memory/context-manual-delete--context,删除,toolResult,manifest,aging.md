# Context 面板：删除 + Aging 展示

关键词：`context` `aging` `distill` `toolResult` `manifest`

## 手动删除机制
- 标记 toolCallId，在 context 事件的浅拷贝 messages 上 splice，不修改 pi 原始对话历史
- `manuallyDeletedIds: Set<string>` 持久化到 manifest

## Aging 计数展示（⏳N）

### 数据流
1. `index.ts` context 事件 → agingTracker 计数 + setAgingSnapshot
2. `collect.ts` collectData → 从 agingSnapshot 读取 → RecordItem.agingCount
3. `render.ts` renderRecords → 显示 `⏳{agingCount}`

### 关键机制：agingDeletedIds（永久删除标记）
- aging 达到阈值后，tcId 加入 `agingDeletedIds` 集合并持久化到 manifest
- 后续每轮 context 事件直接跳过这些 tcId（类似 manuallyDeletedIds）
- **为什么需要**：pi 每轮从内部消息历史重建 messages，被 splice 的 toolResult 下轮又出现，
  没有 `agingDeletedIds` 会导致"删除→回来→重新计数→再删"的无限循环

### Manifest 按会话隔离
- 路径：`/tmp/pi-distill/{sessionId}/manifest.json`
- `setSessionId()` 在 context 事件中从 `ctx.sessionManager.getSessionId()` 获取
- 解决多 pi 进程并行时互相覆盖 manifest 的问题

### Manifest 格式
```json
{
  "distilled": [[tcId, {tmpPath, originalTokens, ...}]],
  "manuallyDeleted": ["tcId1"],
  "agingDeleted": ["tcId2", "tcId3"]
}
```

### 踩坑记录（2025-05-22）
1. **agingTracker 闭包变量** → 移到 shared.ts 作为 `export const`
2. **`export let` jiti/CJS live binding 失效** → 改用 `export const` + clear/set 操作同一对象
3. **`export const` Map 在 jiti 多模块实例间不同步** → 必须用 `globalThis` 注册单例
4. **globalThis 是进程级的，多会话共享同一 Node.js 进程** → 必须用 sessionId 隔离：`globalThis.__agingSnapshots[sessionId]`
5. **达标 tcId 未清理，值无限累积** → aging 遍历中记录并删除
6. **多进程共享 manifest** → 按会话隔离 manifest 路径
7. **aging 删除后下轮又回来** → agingDeletedIds 持久集合，和 manuallyDeletedIds 同级
8. **collect 中 tcId 匹配不上 agingSnapshot** → setLastContextMessages 必须在 context 事件末尾（aging/distill/truncate 之后）调用，否则保存的是旧 messages，tcId 和 agingSnapshot 不同步
9. **collect 在 context 事件之前执行时 currentSessionId 为空** → collect 必须从 `ctx.sessionManager.getSessionId()` 获取 sessionId 并调用 `setSessionId()`，否则 Proxy 查找 `globalThis.__agingSnapshots['']` 找不到数据

### 关键约束
- **禁止 `export let` + 重新赋值**：必须用 `export const` + 操作同一对象引用
- **所有删除标记必须持久化**：manuallyDeletedIds、agingDeletedIds 都持久化到会话级 manifest
- **调试日志**：DBG 函数写 `/tmp/pi-context-debug.log`，按 `[PID]` 区分进程
