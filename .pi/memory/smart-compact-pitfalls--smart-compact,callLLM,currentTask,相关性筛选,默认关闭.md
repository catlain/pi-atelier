# Smart-Compact 踩坑记录

关键词：`smart-compact` `意图总结` `工具去留` `compaction` `重构`

## 架构重构（v2：意图总结+工具去留）

旧架构（三阶段）：分段摘要 → 相关性筛选 → 合并压缩
问题：工具结果被摘要后丢失精确数据；27段需27次LLM调用

新架构（两阶段）：
1. **意图总结**：提取 user/assistant 非工具文本 → LLM 总结意图
2. **工具去留**：收集 toolCall+toolResult 对 → 带 intent 判断去留 → 保留的原样保留
3. **压缩结果**：意图总结 + 保留的工具结果原文（markdown 字符串）

核心改进：工具结果不被摘要化，原样保留或整对删除

### 文件结构
| 文件 | 职责 |
|------|------|
| intent-extractor.ts | 提取非工具文本 + LLM 生成意图 |
| tool-filter.ts | 收集工具对 + LLM 判断去留 |
| llm-caller.ts | LLM 调用封装 + extractCurrentTask |
| serializer.ts | 消息预处理（截断 thinking/args/result） |
| prompts.ts | intent + filter prompt 模板 |
| config.ts | 配置 + saveConfig |
| types.ts | 类型定义 |

已删除：segmenter.ts, summarizer.ts, merger.ts

## Bug 历史（v1 已修复，部分逻辑随重构重写）

### callLLM is not a function
- index.ts 直接传 model 对象给 callLLM 参数位
- 修复：用 createLLMCaller(ctx, modelId) 构建函数

### 相关性筛选形同虚设（27/27 全部 relevant）
- currentTask 传空字符串，LLM 无法判断相关性
- v2 架构已移除相关性筛选，改为工具去留判断

### /smart-compact 命令不生效
- enabled=false 时命令调 ctx.compact() 被事件处理器跳过
- 修复：命令设 forceRun 标志绕过 enabled 检查

### 单段摘要超窗口
- token 估算 length/4 是英文基准，中文约 1.5 字符/token
- v2 架构不再分段摘要，此问题不再适用

## 设计决策

- **默认关闭自动接管**：config.enabled 默认 false
- **命令切换**：/smart-compact-config auto|manual
- **pi CompactionResult 格式**：就是一个 summary 字符串，pi 把它包装成 user 消息注入上下文
- **工具结果保留原样**：不做摘要，要么完整保留要么整对删除（toolCall+toolResult）
