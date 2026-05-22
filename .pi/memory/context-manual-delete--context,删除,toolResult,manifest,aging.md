# Context 面板：删除 + Aging 展示

关键词：`context` `aging` `distill` `闭包状态` `stateRef`

## 架构（2025-05-22 重构后）

### 文件职责

| 文件 | 职责 | 状态来源 |
|------|------|---------|
| `index.ts` (67行) | 入口，持有所有闭包状态，创建 stateRef | 闭包变量 |
| `handle-context.ts` (162行) | context 事件处理逻辑 | 从 index.ts 接收闭包变量 |
| `context.ts` (151行) | 纯 UI（面板渲染+交互） | 通过 stateRef 参数 |
| `collect.ts` (202行) | 纯计算 collectData(pi, ctx, opts) | 通过 opts 参数 |
| `shared.ts` (122行) | 配置/常量/工具函数 | 无运行时状态 |
| `types.ts` | 类型定义（含 CollectOpts, ContextStateRef） | - |
| `render.ts` | 纯渲染 | - |

### 状态管理

```ts
// index.ts 闭包中持有所有运行时状态
const agingTracker = new Map<string, number>();
const agingSnapshot = new Map<string, number>();
const manuallyDeletedIds = new Set<string>();
const agingDeletedIds = new Set<string>();
let lastMessages: any[] = [];
let sessionId = "";

// 通过 stateRef 传给 context.ts
const stateRef: ContextStateRef = {
  agingSnapshot, manuallyDeletedIds,
  getLastContextMessages: () => lastMessages,
  getLastProviderPayload: () => readFromCache(),
  markManuallyDeleted(tcId) { manuallyDeletedIds.add(tcId); saveManifest(); },
};

registerContextCommand(pi, stateRef);
```

## 手动删除机制
- 标记 toolCallId，在 context 事件的浅拷贝 messages 上 splice
- `manuallyDeletedIds: Set<string>` 持久化到 manifest

## Aging 计数展示（⏳N）

### 关键机制：agingDeletedIds（永久删除标记）
- aging 达到阈值后，tcId 加入 `agingDeletedIds` 集合
- 后续每轮 context 事件直接跳过（类似 manuallyDeletedIds）
- **为什么需要**：pi 每轮从内部消息历史重建 messages，没有 `agingDeletedIds` 会导致"删除→回来→重新计数"循环

### Manifest 按会话隔离
- 路径：`/tmp/pi-distill/{sessionId}/manifest.json`
- sessionId 从 `ctx.sessionManager.getSessionId()` 获取
- 包含：distilled、manuallyDeleted、agingDeleted

### 关键约束
- **运行时状态必须在入口闭包中**：jiti `moduleCache:false` 导致模块级状态不可靠
- **所有删除标记必须持久化**：manuallyDeletedIds、agingDeletedIds 持久化到会话级 manifest
- **agingTracker/agingSnapshot 不持久化**：reload 后从 0 开始计数
