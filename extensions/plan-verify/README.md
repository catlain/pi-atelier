# Plan-Verify Extension

使用子代理实现 **Explore → Plan → Verify → Fix → Execute** 工作流，确保方案基于充分的代码探索、经过独立审查后才执行。

## 核心思想

Plan 和 Verify 在完全独立的子进程中运行（通过 `pi --mode json` 启动），每个角色拥有干净的上下文窗口，互不污染：

- **Explorer 子代理**：深入分析代码架构、调用链路和现有模式，产出 Context 节
- **Planner（主会话）**：基于探索结果撰写完整方案
- **Reviewer 子代理**：只看到方案原文 + 审查提示，无 plan 阶段的认知惯性
- **Fixer 子代理**：根据审查问题修正方案，修正后自动再审查
- **主会话**：编排流程，根据审查结果决定迭代或执行

## 命令

| 命令 | 说明 |
|------|------|
| `/plan-verify [file]` | 启动工作流。可选参数：方案文件保存路径 |
| `/pv [file]` | 快捷别名 |
| `/pv-status` | 查看当前状态（阶段、轮次、问题数） |
| `/pv-verify` | 手动触发独立审查 |
| `/pv-abort` | 中止工作流 |
| `/pv-execute` | 跳过审查，直接执行方案 |
| `Ctrl+Alt+V` | 切换工作流（启动/停止） |

## 注册的工具

| 工具名 | 说明 | LLM 何时调用 |
|--------|------|-------------|
| `pv(action: "explore")` | 启动 Explorer 子代理分析代码 | 写方案之前（探索优先原则） |
| `plan_verify_review` | 启动独立子代理审查方案 | Planner 完成方案后 |
| `plan_verify_fix` | 启动独立子代理修正方案 | 审查发现问题时 |
| `plan_verify_execute` | 标记审查通过，进入执行模式 | 审查通过（无 critical）后 |

## 工作流

```
/pv [file]
    │
    ▼
┌─ Planning 阶段 ───────────────────────────────────┐
│  1. LLM 调用 pv(action: "explore") 启动代码探索     │
│     → Explorer 子代理分析代码，写入 Context 节       │
│  2. LLM 基于探索结果撰写完整方案                     │
│     → 补充 实施步骤 / 测试策略 / 风险                │
│  3. 方案完成后调用 plan_verify_review               │
└──────────────────────────────────────────────────┘
    │
    ▼
┌─ Verify 阶段 ───────────────────────────────┐
│  启动独立子代理（只看到方案原文 + 审查提示）     │
│  审查维度（按优先级）：                         │
│    0. 测试完备性（最高优先级）                   │
│    1. 架构合理性                               │
│    2. 可行性                                   │
│    3. 完整性                                   │
│    4. 安全性                                   │
│    5. 性能                                     │
│    6. 可维护性                                 │
└─────────────────────────────────────────────┘
    │
    ├── 审查通过（无 critical）──→ plan_verify_execute ──→ 执行
    │
    └── 有问题 ──→ plan_verify_fix ──→ 自动再审查（最多 3 轮）
```

## UI 显示

- **状态条**：底部显示当前阶段（📝 Planning / 🔍 Reviewing / 🔧 Fixing / 🚀 Executing）
- **Widget**：显示审查发现的问题列表（✖ Critical / ⚠ Warning / 💡 Suggestion）
- **状态持久化**：通过 `pi.appendEntry()` 保存到会话，`/new` 或 reload 后自动恢复

## 审查维度说明

Reviewer 会逐项检查以下维度，发现问题时用 `[Critical]` / `[Warning]` / `[Suggestion]` 标记：

### 0. 测试完备性（最重要）
- 每个核心功能是否有单元测试（正常路径 + 边界 + 错误）
- 模块间交互是否有集成测试
- 测试用例表是否与实现步骤一一对应

**注意：Review 审查的是 Test Specification（测试策略和场景覆盖），不是 Test Implementation（mock helper、factory 函数、fixture 定义）。Test Implementation 由 `tdd_write_tests` 子代理负责。**

| 步骤 | 职责边界 |
|------|----------|
| **plan_verify_review** | 审查 Test Specification：测试策略、场景覆盖、与实现步骤的对应关系。不审查 mock helper 函数签名、factory 函数实现、测试代码是否可编译运行 |
| **tdd_write_tests** | 编写 Test Implementation：定义 mock helper、factory 函数、fixture，补全测试用例的具体实现代码，确保测试可直接运行 |
| **plan_verify_execute** | 按方案实现功能代码，测试已由 tdd_write_tests 准备好 |
| **tdd_run_tests** | 运行测试验证实现，失败则反馈给 execute 修复 |

### 1. 架构合理性
- 职责划分、数据流、SOLID 原则

### 2. 可行性
- API/库是否真实存在、类型是否匹配、并发处理

### 3. 完整性
- 错误处理、边界情况、初始化/清理步骤

### 4. 安全性 / 5. 性能 / 6. 可维护性

## 依赖

- 需要 `pi` 命令在 PATH 中可用（子代理通过 spawn 调用）
- 如果有 subagent 扩展可用，Planner 会优先使用独立上下文窗口
