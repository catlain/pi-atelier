# 日总结 — 2026-05-22（周五）

> pi-atelier commits: 68 | quant commits: 35

---

## pi-atelier：context 扩展核心重构日（68 commits）

### 1. Context 扩展：distill + aging 统一流程（最核心）
- **问题**：distill（自动压缩）和 aging（按轮次遗忘）独立运行，互相覆盖数据
- **解决**：合并为统一删除流程，共享 agingDeletedIds / manuallyDeletedIds
- agingCounts 持久化到 manifest，reload 后延续计数
- distill count=2 静默删除，count=1 给 AI 提示用精确方法获取

### 2. 闭包状态架构重构（关键修复）
- **问题**：jiti 多模块实例导致 globalThis 变量不共享，agingSnapshot 互相覆盖
- **方案**：闭包状态 + Proxy + sessionId 隔离，解决多会话共享问题
- setLastContextMessages 移到事件末尾，和 agingSnapshot 同步

### 3. Aging 计数修复（踩坑最多）
- 三次反复修复：
  1. agingSnapshot 改 export const + clear/set 修复 live binding 失效
  2. 达到阈值后从 tracker 清除 + 快照在 cleanup 后保存
  3. 不持久化到 manifest，避免多 pi 进程互相覆盖
- 最终方案：agingDeletedIds 持久化到 manifest + 请求计数不持久化

### 4. 手动删除功能
- context 面板增加 d 键标记删除
- manifest 持久化删除状态

### 5. Code-graph 格式化器集成
- 替代 cartog：新增 code-graph 工具结果格式化器
- 支持多种输出类型（search_symbols, find_references, get_call_graph 等）
- 34 个格式化器链集成测试

### 6. Smart-compact 重构
- 两阶段：意图总结 + 工具去留筛选
- 默认关闭自动接管，改为手动 `/smart-compact` 触发
- `/smart-compact-config auto|manual` 切换模式
- /命令强制走增强压缩 + 降低段上限

### 7. Cartog 彻底清理
- 移除 cartog-manager 及所有 cartog 相关代码
- 更新 cartog-removed 记忆文件

### 8. 记忆系统重构
- 记忆注入统一到 memory 扩展（从 env-and-status 迁移）
- env-and-status 拆分：279 行 → 39 行
- 记忆文件行数限制 80→200
- 文件数量限制参数化

### 9. MCP-lite 修复
- GLM MCP 服务不可用 — 跳过 GET SSE 初始化

### 10. Formatter 语义验证
- formatter 语义验证 + 5 个测试文件断言修复

---

## quant 项目：Rust 迁移收官日（35 commits）

### 1. Rust 架构统一方案 v2 实施
- **Phase 3+3.5**: manager 分析迁移 Rust + 全模块参数化重构
- **Phase 4**: 删除 Rust Axum server + sidecar，修正字段映射
- maturin 双 .so 踩坑记录
- **全部 Phase 完成**

### 2. DuckDB 基础设施
- 后端读写分离：只读连接不阻塞 CLI 进程
- analysis_cache 改文件缓存（解决同进程 DuckDB 限制）
- sync_data.py 加 DuckDB 锁检测
- ETF 数据入 DuckDB + 统一数据同步 CLI
- 行业因子数据从 DuckDB 读取，消除 API 调用
- fund_nav 双数据源策略（tushare + akshare 取并集）
- fetch_sw_level1_returns 缓存降级 — API 限频时使用过期缓存

### 3. 架构规则
- check_arch 新增 Rust crate 依赖规则 + Python 编排层禁止模式

### 4. PyO3 踩坑
- manager PyO3 类型修复：tuple 元素需为 String(JSON) 而非 list

---

## 其他

### Compaction 失败
- 晚间出现 Summarization 失败导致会话中断
- 尝试修复 serializer.ts, segmenter.ts, prompts.ts

### 会话接手
- 多次接手前一会话（因 provider finish_reason 错误或 compaction 失败而中断的）

---

## 总结

**pi-atelier 爆发日**：68 个提交，是本周最多的一天。context 扩展经历了 distill+aging 统一、闭包状态重构、aging 计数三轮修复等核心架构变更。quant 项目 Rust 迁移全部 Phase 完成，DuckDB 基础设施大幅增强。
