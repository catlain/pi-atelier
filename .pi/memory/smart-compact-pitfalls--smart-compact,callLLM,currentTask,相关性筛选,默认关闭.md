# Smart-Compact 踩坑记录

关键词：`smart-compact` `callLLM` `currentTask` `token估算` `分段上限`

## Bug 1: callLLM is not a function

- **根因**：index.ts 直接传 model 对象给 `summarizeSegments` 的 `callLLM` 参数
- **修复**：用 `createLLMCaller(ctx, modelId)` 构建函数再传入

## Bug 2: 相关性筛选形同虚设（27/27 全部 relevant）

- **根因**：`currentTask` 传空字符串，LLM 无法判断相关性
- **修复**：调用 `extractCurrentTask()` 从尾部消息提取任务描述

## Bug 3: /smart-compact 命令不生效（仍走 pi 内置 compaction）

- **根因**：`config.enabled = false` 后，`/smart-compact` 命令调 `ctx.compact()` 触发事件处理器，但处理器检查 `!enabled` 直接返回 `{}`，导致 pi 内置 compaction 对大 session 也超窗口失败
- **修复**：命令设 `forceRun` 标志，事件处理器改为 `if (!enabled && !forceRun) return {}`
- **提交**：fb44357

## Bug 4: 单段摘要仍超模型窗口

- **根因**：`MAX_SEGMENT_TOKENS = 30000` + token 估算 `length/4`（英文基准），中文实际 ~1.5 字符/token，导致实际 token 远超预估
- **修复**：
  - `MAX_SEGMENT_TOKENS` 从 30000 降到 12000
  - token 估算从 `length/4` 改为 `length/2.5`
- **提交**：fb44357

## 设计决策

- **默认关闭自动接管**：`config.enabled` 默认 `false`，`/smart-compact` 命令强制走增强压缩（`forceRun` 标志绕过 enabled）
- **命令切换**：`/smart-compact-config auto|manual` 可改配置
