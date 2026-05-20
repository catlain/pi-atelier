# pi-atelier

[pi](https://github.com/earendil-works/pi-coding-agent) 的扩展工具集合。

## 包含

### 扩展 (Extensions)

| 扩展 | 说明 |
|------|------|
| **context** | 上下文管理与工具结果处理 |
| **env-and-status** | 环境变量注入、Session ID、记忆注入、Cartog 聚合索引 |
| **journal** | 日志记录（开发中） |
| **mcp-lite** | MCP 工具调度（Web Search/Reader、GitHub zread、Vision 分析等） |
| **memory** | 记忆管理（memory_index 查询、memory_update 写入） |
| **notification** | 通知系统 |
| **payload-analyzer** | Payload 录制分析（token 分布、增长趋势、distill 行为验证） |
| **plan-verify** | SDD+TDD 工作流：Explore → Plan → Review → Execute → Verify |
| **scheduler** | 会话内定时任务（/loop、/remind、/tasks） |
| **session-analyzer** | 会话分析（跨会话搜索、单会话分析、审计） |
| **shepherd** | 代码质量检查（格式规范、依赖规范、TOML 安全） |
| **subagent** | 子代理管理（独立上下文窗口执行任务） |
| **voice-input** | 语音输入（需 native 依赖） |
| **workflow** | 通用工作流编排引擎 |

### 共享库 (lib)

| 库 | 说明 |
|----|------|
| **shared-utils** | 路径常量、类型定义、工具函数 |
| **workflow-core** | 工作流核心引擎（状态机、子代理调度） |
| **cartog-manager** | Cartog 索引管理器（外部目录软链接、聚合索引） |
| **shepherd** | 代码质量检查核心库 |

## 安装

```bash
pi install git:github.com/<your-username>/pi-atelier
```

> ⚠️ **voice-input** 需要 native 依赖（sherpa-onnx-node、naudiodon2），安装时可能需要额外的系统库。如果不需要语音输入功能，可以排除。

## 开发

```bash
# 克隆后安装依赖
git clone https://github.com/<your-username>/pi-atelier.git
cd pi-atelier
npm install

# 验证 typecheck
cd extensions/<某个扩展> && npx tsc --noEmit
```

## 许可证

MIT
