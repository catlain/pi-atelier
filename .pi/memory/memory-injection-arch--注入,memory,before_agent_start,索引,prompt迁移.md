# Memory 注入架构

`关键词`: 注入 memory before_agent_start 索引 prompt迁移 磁盘真相源

## 统一入口

所有记忆注入（prompt 说明 + 索引内容）统一在 **memory 扩展**：
- `lib/memory-hook.ts` — 注册 `before_agent_start` hook
- `lib/memory-inject.ts` — 读取 L1/L2 `MEMORY.md` 索引，构建注入文本
- `memory-prompt.md` — 说明文本（"你有记忆，路径在哪"）

## 注入流程

1. `before_agent_start` 触发
2. 读取 `memory-prompt.md` 说明文本
3. 调用 `resolveMemoryInjection(cwd)` 读取 `~/.pi/agent/memory/MEMORY.md` + `.pi/memory/MEMORY.md`
4. 拼接后追加到 `systemPrompt`

## env-and-status 不再负责记忆注入

之前 env-and-status 有 `before_agent_start` hook 注入 prompt，已迁移。
env-and-status 只保留环境检测（session 等）。

## 参数化常量（lib/types.ts）

| 常量 | 值 | 用途 |
|------|----|------|
| MAX_FILE_LINES | 200 | 单文件行数软上限 |
| MAX_MERGED_LINES | 400 | 合并后行数硬上限 |
| HARD_FILE_LIMIT | 40 | 文件数硬拒绝 |
| SOFT_FILE_LIMIT | 25 | 文件数软警告 |
| HINT_FILE_LIMIT | 20 | 文件数轻提示 |

## 索引重建策略（2026-05-25 重构）

**核心决策：磁盘文件是唯一真相源，索引全量重建。**

- 旧方式 `updateIndex`：增量追加条目到 MEMORY.md，手动删文件后索引不一致
- 新方式 `rebuildIndex`：每次 write 后全量扫描目录，重建 表格+链接区
- `memory_index` 调用时也触发 `rebuildIndex`，修复手动操作导致的不一致
- 实现：`lib/writer.ts` 的 `rebuildIndex(targetDir, indexPath, scope)`
- 调用点：`memory_update` 写文件后 + `memory_index` 读索引前
