# 日总结 — 2026-05-21（周四）

> pi-atelier commits: 2 | quant commits: 43

---

## quant 项目：Rust 迁移高潮日（43 commits）

### 1. 仓库合并（重大）
- 合并 quant-base + quant-fund + quant-strategy 为统一仓库
- 跨项目数据流分析 + RISK-11 重构方案确认
- 输出完整架构文档（ARCHITECTURE.md, DATA_MODEL.md, DEPENDENCY_RULES.md, RISK_REGISTER.md 等）

### 2. Rust 后端迁移 Phase 1-3
- **Phase 1**: DataStore 增加通用方法（upsert/query/table_empty/register_schema）
- **Phase 2**: Schema 外置 + quant-fund 迁移到 DataStore
- **Phase 3**: quant-fund 全量迁移到通用 DataStore 方法
- **R2 Stage 1-3**: stock_daily 表加 market 列 + 合并美股 fetcher + DuckDB 双写 + Processor 走 DataStore

### 3. Rust 分析模块
- 新建 quant_fund_analysis crate + PyO3 绑定
- quant_math::financial 统一金融统计量抽象（Steps 1-6）
- quant_fund_analysis 参数化重构

### 4. 架构统一方案 v2
- 决定用 PyO3 模式替代独立 Rust 进程（sidecar）
- 6 阶段消除 Python sidecar 方案

### 5. 风险清理（R1-R8）
- R1: Ward linkage 返回 Err 而非 panic
- R2: Stage 1-3 code review 修复
- R3: 清除 SizerConfig 废弃路径 + 删除 quant-backtest-cli 死代码 (~1100 行)
- R5: 清理因子模块死代码（FactorCalculator/ICM/hybrid_engine）
- R7: cache.rs RwLock unwrap → unwrap_or_else 防 poisoning
- R8: DuckDB 并发安全 — DataStore 进程内单例 + 文件锁 + 连接重试
- F-1: 参数化查询防注入

### 6. Codebase-recon 文档化
- 对统一仓库运行 all-in-one codebase-recon
- 输出 REPO_INVENTORY.md, VALIDATION_BASELINE.md 等完整文档

### 7. Cartog 配置与清理
- 3 个子目录 cartog-ext 删除
- cartog 工具说明写入 AGENTS.md
- quant 目录名统一（Quant → quant）

### 8. 其他量化工作
- 另类因子管线（卖空、融券、北向、SUE）
- 港股数据源调研（fetcher_hk.py）
- 垂杨柳小学小升初搜索
- scan_alternative Alpha/Beta/ExS 无输出问题修复

---

## pi-atelier（2 commits）

### formatWebSearchResult 语义验证
- 修复 web 搜索格式化器的误匹配问题
- 拆分 formatters-web.ts，增加语义验证

### codebase-recon all-in-one
- 10 pass 架构文档生成

---

## Voice-input

### 录音为空问题（多次会话）
- 关一段时间麦克风再开就报"录音为空"
- 重构 pulse.ts / vad-recorder.ts
- 修复 fallback-recorder.ts

### 麦克风静音问题
- Alt+Q 开麦克风可以，但再按不会 mute 上
- 创建 mic-mute.ps1 脚本

### Shepherd 记忆文件长度告警
- voice-input-ext 记忆文件过长触发告警
- 修改 line-count.ts 规则和限制

---

## 总结

**quant Rust 迁移爆发日**：43 个提交，仓库合并、Phase 1-3 完成、风险清理 R1-R8。pi-atelier 侧主要修了 web 搜索格式化器。voice-input 反复调试录音问题。
