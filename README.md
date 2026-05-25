# pi-atelier

[pi-coding-agent](https://github.com/earendil-works/pi-coding-agent) 的扩展集合。每个扩展都是独立可安装的包，按需取用。

> ⚠️ 本仓库已归档。所有扩展已拆分为独立包，不再需要安装整个 monorepo。

## 扩展列表

### 🧠 记忆与知识

| 包 | 说明 | 安装 |
|---|------|------|
| [pi-memory](https://github.com/catlain/pi-memory) | 跨会话持久记忆 — 文件即记忆，自动索引，冲突检测 | `pi install git:github.com/catlain/pi-memory` |
| [pi-context](https://github.com/catlain/pi-context) | 上下文管理 — 工具结果格式化、蒸馏、上下文面板 | `pi install git:github.com/catlain/pi-context` |
| [pi-smart-compact](https://github.com/catlain/pi-smart-compact) | 智能上下文压缩 — LLM 辅助相关性筛选 | `pi install git:github.com/catlain/pi-smart-compact` |

### 📊 分析与调试

| 包 | 说明 | 安装 |
|---|------|------|
| [pi-payload-analyzer](https://github.com/catlain/pi-payload-analyzer) | Provider payload token 分析 — 预算、增长趋势、昂贵调用 | `pi install git:github.com/catlain/pi-payload-analyzer` |
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
# 按需安装想要的扩展，例如：
pi install git:github.com/catlain/pi-memory
pi install git:github.com/catlain/pi-roadmap
pi install git:github.com/catlain/pi-context
```

安装后重启 pi 即可使用。

## 卸载

```bash
pi uninstall git:github.com/catlain/pi-memory
```

## 许可

MIT
