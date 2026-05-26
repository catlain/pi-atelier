# pi-atelier

[pi](https://github.com/earendil-works/pi-coding-agent) 的扩展集合 — 模块化的 AI 编程助手增强工具箱。

> ⚠️ 本仓库已归档。所有扩展已拆分为独立包，按需取用。

## 哲学

pi-atelier 遵循 **Unix 哲学**：每个扩展做好一件事，通过组合构建强大的工作流。

- **按需取用** — 只安装你需要的扩展，不捆绑不需要的功能
- **独立演进** — 每个包独立版本、独立发布、独立更新
- **零冲突** — 扩展之间松耦合，不会互相干扰
- **可组合** — 多个扩展协同工作时效果更好（如 memory + shepherd + roadmap）

## 扩展列表

### 🧠 记忆与知识

| 包 | 说明 | 安装 |
|---|------|------|
| [pi-memory](https://github.com/catlain/pi-memory) | 跨会话持久记忆 — 文件即记忆，自动索引，冲突检测 | `pi install git:github.com/catlain/pi-memory` |
| [pi-context-manager](https://github.com/catlain/pi-context-manager) | 上下文管理 + Token 诊断 — 工具结果格式化、蒸馏、payload 分析 | `pi install git:github.com/catlain/pi-context-manager` |
| [pi-smart-compact](https://github.com/catlain/pi-smart-compact) | 智能上下文压缩 — LLM 辅助相关性筛选 | `pi install git:github.com/catlain/pi-smart-compact` |

### 📊 分析与调试

| 包 | 说明 | 安装 |
|---|------|------|
| [pi-session-analyzer](https://github.com/catlain/pi-session-analyzer) | 历史会话搜索与分析 — grep、时间线、审计、接手报告 | `pi install git:github.com/catlain/pi-session-analyzer` |

### 🔄 工作流

| 包 | 说明 | 安装 |
|---|------|------|
| [pi-workflow](https://github.com/catlain/pi-workflow) | 工作流编排 — 子代理生成、研究工作流、输出捕获 | `pi install git:github.com/catlain/pi-workflow` |
| [pi-shepherd](https://github.com/catlain/pi-shepherd) | 行为规则引擎 — 工具调用钩子、行数守卫、会话事件 | `pi install git:github.com/catlain/pi-shepherd` |
| [pi-roadmap](https://github.com/catlain/pi-roadmap) | 项目路线图管理 — Epic/Story/Task 规划、进度追踪 | `pi install git:github.com/catlain/pi-roadmap` |
| [pi-scheduler](https://github.com/catlain/pi-scheduler) | 定时任务 — 定时消息、循环提示、任务自动化 | `pi install git:github.com/catlain/pi-scheduler` |
| [pi-journal](https://github.com/catlain/pi-journal) | 会话日志 — 自动记录、条目索引、时间线重建 | `pi install git:github.com/catlain/pi-journal` |

### 📚 共享库

| 包 | 说明 | 安装 |
|---|------|------|
| [pi-shared-utils](https://github.com/catlain/pi-shared-utils) | 共享工具库 — 记忆解析、settings、路径、工具输出截断 | `pi install git:github.com/catlain/pi-shared-utils` |

> 💡 `pi-shared-utils` 会通过 `bundledDependencies` 自动安装，通常不需要单独安装。

## 快速开始

```bash
# 1. 基础增强（推荐所有项目）
pi install git:github.com/catlain/pi-memory
pi install git:github.com/catlain/pi-context-manager

# 2. 项目管理
pi install git:github.com/catlain/pi-roadmap
pi install git:github.com/catlain/pi-shepherd

# 3. 分析调试（按需）
pi install git:github.com/catlain/pi-session-analyzer
```

安装后重启 pi 即可使用。

### 推荐组合

| 组合 | 扩展 | 适合场景 |
|------|------|----------|
| **日常开发** | memory + context-manager + shepherd | 记住上下文 + 防止越界 |
| **项目管理** | roadmap + shepherd + scheduler | 规划 + 规则 + 定时提醒 |
| **深度调试** | context-manager (payload_analyze) + session-analyzer | token 分析 + 会话审计 |
| **团队协作** | memory + shepherd + journal | 知识积累 + 规范 + 日志 |

## 贡献

每个扩展都是独立仓库。要贡献：

1. Fork 对应的扩展仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交改动 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发指南

- TypeScript 严格模式
- 通过 `bundledDependencies` 管理共享依赖
- 每个扩展遵循统一的入口模式（`index.ts` → `registerExtension`）
- 测试用 `vitest`

## 卸载

```bash
pi uninstall git:github.com/catlain/pi-memory
```

## 许可

MIT
