# 周总结（5月19日–5月22日）

> 截止日期：2026-05-22（周五）  
> 涉及项目：pi-atelier（90 commits）、quant（78 commits）

---

## 一、pi-atelier 扩展开发

### 1. context 扩展：distill + aging 统一流程（核心重构）
- **问题**：distill（自动压缩工具结果）和 aging（按轮次遗忘旧结果）两套机制独立运行，存在冲突——distill 删除的结果在 aging 面板中又冒出来。
- **方案**：合并为统一删除流程，共享 `agingDeletedIds` / `manuallyDeletedIds` 状态。
- **关键改动**：
  - 闭包状态架构重构：消除 jiti 多模块实例问题（变量不共享）
  - agingCounts 持久化到 manifest，pi 重启后计数延续
  - distill count=2 静默删除，count=1 给 AI 提示用精确方法获取
  - handle-context.ts 变量名修正（manuallyDeleted → manuallyDeletedIds）
  - getContextConfig 恢复从 settings.json 读取（不再硬编码）
  - collect 中从 ctx.sessionManager 获取 sessionId
- **测试**：格式化器链集成测试 34 个 + toRemove 排序 + handleContextEvent 集成测试 17 个

### 2. context 扩展：手动删除功能
- 用户可在 `/context` 面板中选择工具结果条目查看，然后选择删除
- 涉及文件：types.ts, shared.ts, collect.ts, render.ts, context.ts

### 3. code-graph 格式化器集成（替代 cartog）
- 新增 code-graph 工具结果格式化器，支持 search_symbols / find_references / get_call_graph 等输出格式
- 删除 cartog 相关引用和技能
- AGENTS.md 中加入 code-graph 使用引导

### 4. smart-compact 重构
- 重构为两阶段：意图总结 + 工具去留筛选
- `/smart-compact-config auto|manual` 命令切换模式
- /命令强制走增强压缩 + 降低段上限防超窗口
- 调用 extractCurrentTask 提取任务描述用于相关性筛选

### 5. 记忆系统调优
- 调查了记忆文件 40 个上限未生效的问题（硬编码 + 配置读取链路修复）
- 清理了大量碎片化记忆文件
- L1/L2 记忆索引注入到系统提示词的修复
- formatter-chain-pattern、distill-提示设计原则等新记忆条目

### 6. Shepherd 规则更新
- rules.json 中加入 code-graph 使用引导规则
- 修正了记忆文件长度限制的规则和提示

### 7. 其他
- Skill conflicts 解决（SKILL.md 去重）
- cartog 技能彻底清理（索引 + 扩展 + 记忆）
- `/@pi-ecosystem/` 目录清理确认
- MCP 服务不可用问题排查（mcp-client.ts 修复）
- pi-kota 包版本查询

---

## 二、quant 量化项目

### 1. Rust 迁移（核心后端）
- **Phase 3 + 3.5 完成**：manager 分析迁移 Rust + 全模块参数化重构
- **Phase 4 完成**：删除 Rust Axum server + sidecar 模式，简化架构
- **Phase 全部完成**：全部迁移至 PyO3 + DuckDB 纯读架构
- check_arch 新增 Rust crate 依赖规则 + Python 编排层禁止模式
- PyO3 类型踩坑修复（tuple 元素需为 String(JSON) 而非 list）
- maturin 双 .so 踩坑记录

### 2. DuckDB 数据基础设施
- 后端读写分离：只读连接不阻塞 CLI 进程
- analysis_cache 改文件缓存方案（解决同进程 DuckDB 限制）
- sync_data.py 加 DuckDB 锁检测，提示停后端后再同步
- ETF 数据入 DuckDB + 统一数据同步 CLI
- 行业因子数据从 DuckDB 读取，消除 API 调用
- fund_nav 双数据源策略（tushare + akshare 取并集）
- 批量基金净值同步脚本 + analysis_cache 缓存文件

### 3. 基金网站前端
- 首页基金筛选增强：加按年筛选（成立时间超 1/2/3/5 年）
- 基金净值展示修复（排序问题）
- ManagerProfile 页面修复
- 5年基金只有3年净值时的交互问题修复

### 4. 项目拆分准备
- 分析了将量化回测、基金数据分析、数据获取存储拆成 3 个独立项目的方案
- 输出 split-plan.md

### 5. 量化因子
- 回测脚本测试（cluster_sharpe、pipeline 等）
- 另类因子管线讨论（卖空、融券、北向、SUE）
- 港股数据源调研（tushare fetcher_hk）
- 垂杨柳小学小升初成绩搜索（非量化，个人信息需求）

---

## 三、voice-input 语音输入扩展

- 脉冲音频录制器重构（pulse.ts / vad-recorder.ts）
- mic-mute.ps1 脚本：Alt+Q 控制麦克风静音/取消静音
- 修复"关一段时间再开就录音为空"问题
- 关闭 debug 日志减少 token 浪费
- 记忆文件 voice-input-ext 过长问题修复

---

## 四、其他项目/工具

### codebase-recon 对多个项目运行
- quant-fund、quant-strat 等子项目分别运行 codebase-recon
- 输出 ARCHITECTURE.md、DATA_MODEL.md、DEPENDENCY_RULES.md 等架构文档

### quant 项目 Cartog 配置
- 3 个 quant 子目录配置 cartog 跨目录索引
- 后续清理 cartog（被 code-graph 替代）
- quant 目录名统一（Quant → quant）

### 搜索与信息获取
- 垂杨柳小学小升初成绩搜索
- pyright 测试工具分析（微信公众号文章）
- pi-agent-codebase-workflows 和 supi-code-intelligence 扩展安装

---

## 本周关键数据

| 指标 | 数值 |
|------|------|
| pi-atelier commits | 90 |
| quant commits | 78 |
| 会话数（5/19-5/22） | ~40+ |
| 新增测试用例 | 51+ |
| 涉及主要文件 | 100+ |

---

## 遗留/待跟进

1. **voice-input**：从扩展到输入法的方案讨论（5/25 已启动）
2. **quant 项目拆分**：方案已出，待执行
3. **smart-compact 自动模式**：默认关闭，需要更多测试
4. **code-graph 覆盖度**：对 TS 代码的覆盖分析已完成，部分边界情况待处理
5. **compaction 失败**：5/22 晚出现 Summarization 失败导致会话中断，待排查
