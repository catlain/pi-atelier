# 路线图差异分析

你正在帮助用户更新路线图。请对比以下两份内容，判断需要做什么变更。

## 已有路线图
{{existingRoadmap}}

## 当前讨论摘要
{{discussionSummary}}

## 分析要求

### 1. 逐 Epic 对比
对每个已有 Epic，判断：
- ✅ 与讨论一致 → 保留，不做修改
- 🔄 部分调整 → 列出具体调整点（优先级变化？范围变化？）
- ❌ 被讨论否定 → 标记为 dropped
- ➕ 讨论中新增 → 需要创建新 Epic

### 2. 逐 Story 对比（在匹配的 Epic 内）
对每个已有 Story，判断：
- ✅ 保留
- 🔄 调整（改描述、改拆解粒度）
- ❌ dropped
- ➕ 新增

### 3. 逐 Task 对比（在匹配的 Story 内）
对每个已有 Task，判断：
- ✅ 保留
- ❌ dropped
- ➕ 新增

### 输出
输出变更清单，格式：
- [Epic] ADD/KEEP/MODIFY/DROP: 标题 — 原因
- [Story] ADD/KEEP/MODIFY/DROP: 标题 — 原因
- [Task] ADD/KEEP/MODIFY/DROP: 标题 — 原因

然后输出完整的更新后 roadmap JSON（不只是变更部分）。

## 重要约束
- 已有的 done 状态项保持原样（不改状态、不改内容）
- 只修改 todo/doing/blocked 状态的项
- dropped 的项除非用户明确要求恢复，否则保持 dropped
