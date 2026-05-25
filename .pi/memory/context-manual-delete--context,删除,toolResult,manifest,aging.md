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
| `shared.ts` (~150行) | 配置/常量/工具函数 + hints 配置 | 无运行时状态 |
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

### Distill + Aging 统一流程（合并后）
- **distill 和 aging 共用一个遍历**，不分裂为两遍
- **大结果（≥distillThreshold）的 effectiveThreshold=2**，普通结果的 effectiveThreshold=agingThreshold
- 大结果首次出现（count=1）→ 提示用户；次轮（count≥2）→ 删除
- 所有工具结果统一走 agingTracker 计数，面板 ⏳ 数字一致显示
- 删除后统一加入 agingDeletedIds 持久集合
- `seenArgs` 仅用于

### 踩坑：toRemove index 排序（2025-05-22）
- 多个删除通道（agingDeletedIds、manuallyDeletedIds、aging 达到阈值）收集 index 到同一个 `toRemove` 数组
- **必须降序排序后再 splice**：否则 splice 较小 index 后，后续较大 index 指向错误位置
- 例：toRemove=[3,1] → 先 splice(1) → index 3 变成 2 → splice(3) 删错元素
- 修复：`toRemove.sort((a, b) => b - a)` 后再逐个 splice

### 提示文案配置化（hints-default.json）
- **默认模板**：`extensions/context/hints-default.json`
- **用户覆盖**：`~/.pi/agent/extensions/context/hints.json`（只需写要改的字段，自动合并）
- **模板占位符**：`{label}` `{tokens}` `{toolName}` `{tmpPath}` `{preview}` `{more}` `{formatted}`
- **可配置项**：distillWarning、distillWarningShort、processorSummary、processorSmallResult
- **加载逻辑**：`shared.ts` → `loadHintsConfig()` + `fillTemplate()`

### 关键约束
- **运行时状态必须在入口闭包中**：jiti `moduleCache:false` 导致模块级状态不可靠
- **所有删除标记必须持久化**：manuallyDeletedIds、agingDeletedIds 持久化到会话级 manifest
- **agingCounts 持久化到 manifest**：每轮都保存 agingTracker（cleanup 后），reload 后恢复计数
- **saveManifest 必须每轮执行**：不能只在 removedTcIds.size > 0 时调用，否则 agingCounts 只在有删除时才写入
- **distill 删除 = agingDeletedIds 删除**：两个删除通道都要写入同一个持久集合
