# 日总结 — 2026-05-20（周三）

> pi-atelier commits: 20 | quant commits: 0

---

## pi-atelier：项目初始化 + README 完善

### 1. 项目更名与开源准备（重大）
- **pi-lainforge → pi-atelier** 重命名
- 移除 voice-input 扩展（迁出至独立仓库 pi-voice-input）
- 移除 package-lock.json（让用户自己生成）
- 修正硬编码路径（`/home/lain` → `$HOME`）
- 修正 README 安装命令指向 catlain/pi-atelier

### 2. README 文档大改版
- 完整功能说明：所有扩展的命令速查
- context 三层处理流程 + `/context` 交互式可视化详细说明
- 外部依赖说明（可选依赖如 pulseaudio 等）
- 安装指引

### 3. Shepherd 规则迁移
- 将 20 条 quant 项目级规则从全局 rules.json 迁移到项目级 shepherd-rules-quant.json
- 规则文件格式校验

### 4. session-analyzer 增强
- entries 支持 offset 偏移和 grep 关键词过滤
- 跨工具错误检测

### 5. Cartog 修复
- 移除 cartog 索引时间注入
- 修复 JSON 数组误匹配 bug

### 6. 其他
- vitest.config.ts 排除 subagent 测试
- 扩展开发规范 + 安全审查报告

---

## quant 项目（会话活动，无提交）

### 量化回测测试
- 跑回测脚本，验证 cluster_sharpe、pipeline 等是否正常
- 修改了 rules.py, pipeline_ext.py 等

### 项目拆分讨论
- 分析将量化回测、基金数据分析、数据获取存储拆成 3 个独立项目的方案
- 输出 split-plan.md

### Rust 迁移讨论
- 讨论后端全部用 REST 来写是否更好控制
- 分析了 Rust nn_chain bug（已回退，保持 greedy）

### 基金网站
- 基金净值排序修复（017745 基金净值疑似反转）
- 首页加按年筛选（成立时间超 1/2/3/5 年的基金）
- 修复 ManagerProfile 页面

### Cartog 跨目录配置
- 3 个 quant 子目录配置 cartog 跨目录索引

### 数据架构讨论
- 基金数据更新机制梳理
- DuckDB 数据存储和更新触发逻辑

---

## 总结

**pi-atelier 开源准备日**：项目更名、README 完善、规则迁移。同时 quant 项目围绕 Rust 迁移、项目拆分、基金网站修复展开大量讨论（但尚未产生 git 提交，在 5/21 集中提交）。
