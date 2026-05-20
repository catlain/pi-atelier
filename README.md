# pi-atelier

[pi](https://github.com/earendil-works/pi-coding-agent) 的扩展工具集——为你的 AI 编程助手装上更多武器。

## 安装

```bash
pi install git:github.com/catlain/pi-atelier
```

一行命令，pi 会自动 clone、安装依赖、注册所有扩展。重启 pi 即可使用。

> 需要先安装 [pi](https://github.com/earendil-works/pi-coding-agent)。

## 包含哪些扩展

### 🔧 基础设施

| 扩展 | 功能 |
|------|------|
| **env-and-status** | 环境变量注入、Session ID、记忆自动加载、Cartog 聚合索引 |
| **mcp-lite** | MCP 工具调度桥接（Web Search、GitHub 代码阅读、Vision 分析、代码图搜索等） |
| **context** | 上下文管理核心——工具结果蒸馏（distill）、大结果写文件、token 预算控制、录制回放 |
| **notification** | AI 完成回复时播放提示音 + 终端通知 |

### 🧠 记忆与会话

| 扩展 | 功能 |
|------|------|
| **memory** | 文件式持久记忆——`memory_index` 查询、`memory_update` 写入，跨会话保留知识 |
| **session-analyzer** | 会话分析——跨会话全文搜索（grep/file/list）、单会话深度分析（timeline/chain/audit/takeover） |

### 🔄 工作流

| 扩展 | 功能 |
|------|------|
| **plan-verify** | SDD+TDD 工作流：Explore → Plan → Review → Test → Execute → Verify，适合中大型改动 |
| **subagent** | 子代理管理——在独立上下文窗口中启动子任务（代码审查、方案验证、深度分析等） |
| **workflow** | 通用工作流编排引擎——状态机 + 子代理调度，自定义工作流的构建基础 |

### 🔍 开发工具

| 扩展 | 功能 |
|------|------|
| **shepherd** | 代码质量守门员——Hook 规则引擎，检查格式规范、依赖规范、文件安全（阻止 CRLF、禁止大文件覆盖等） |
| **payload-analyzer** | Payload 录制分析——token 成本拆解、上下文增长趋势、最贵工具调用排名、distill 行为验证 |
| **scheduler** | 会话内定时任务——`/loop` 循环执行、`/remind` 定时提醒、`/tasks` 查看任务列表 |

### 📝 其他

| 扩展 | 功能 |
|------|------|
| **journal** | 日志记录（开发中） |

### 共享库

不需要单独安装，作为扩展的内部依赖存在：

| 库 | 说明 |
|----|------|
| **shared-utils** | 路径常量、类型定义、工具函数 |
| **workflow-core** | 工作流核心引擎（状态机、Gate 机制、子代理调度） |
| **cartog-manager** | Cartog 索引管理（外部目录软链接、聚合索引） |
| **shepherd** | 代码质量检查核心规则库 |

## 语音输入

语音输入扩展因为有 native 依赖（sherpa-onnx-node、naudiodon2），单独发布：

```bash
pi install git:github.com/catlain/pi-voice-input
```

## 开发

```bash
git clone https://github.com/catlain/pi-atelier.git
cd pi-atelier
npm install

# 验证某个扩展的 typecheck
cd extensions/<name> && npx tsc --noEmit
```

## 许可证

MIT
