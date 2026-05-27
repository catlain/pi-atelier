# 附录

## A. 扩展速查表

| 扩展 | 安装命令 | 核心工具/命令 | 一句话用途 |
|------|----------|--------------|-----------|
| pi-memory | `"pi-memory"` | `memory_update`, `memory_index` | 跨会话知识持久化 |
| pi-roadmap | `"pi-roadmap"` | `roadmap_plan`, `roadmap_next`, `roadmap_done` 等 | 任务拆解和进度追踪 |
| pi-shepherd | `"pi-shepherd"` | 规则驱动的钩子引擎 | AI 行为守卫（无工具/命令） |
| pi-context-manager | `"pi-context-manager"` | `payload_analyze`, `/record`, `/context`, `/distill-config`, `/aging-config` 等 | 上下文质量控制 + Token 诊断 |
| pi-session-analyzer | `"pi-session-analyzer"` | `session_search`, `session_analyze` | 历史会话搜索和回溯 |
| pi-smart-compact | `"pi-smart-compact"` | `/smart-compact`, `/smart-compact-config` | 长会话智能压缩 |
| pi-scheduler | `"pi-scheduler"` | `schedule`, `/loop`, `/remind`, `/tasks` | 定时任务和提醒 |
| pi-workflow | `"pi-workflow"` | `registerWorkflowTool`（供其他扩展调用） | 工作流框架库 |
| pi-shared-utils | `"pi-shared-utils"` | logger, storage, paths, json, validator, settings-backup, file-lock | 扩展开发工具库 |
| pi-journal | `"pi-journal"` | ✅ 可用 | 日志报告生成器（`/journal` 命令 + `journal` 工具） |

## B. 推荐扩展组合

### 个人项目（轻量组合）

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-smart-compact"
  ]
}
```

核心三件套：记住知识 + 管理任务 + 长会话不笨。

### 团队项目（标准组合）

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-shepherd",
    "pi-session-analyzer",
    "pi-smart-compact"
  ]
}
```

加上规矩和复盘能力。

### 大型重构（全量组合）

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-shepherd",
    "pi-context-manager",
    "pi-session-analyzer",
    "pi-smart-compact",
    "pi-scheduler"
  ]
}
```

全量安装，充分利用诊断和自动化能力。

## C. pi 内部机制速览

### Compaction（压缩）

pi 内置了上下文压缩机制。当对话历史接近上下文窗口上限时，pi 会自动压缩旧对话。Smart Compact 扩展增强了这个机制——它会识别关键信息（决策、约定、结论）优先保留。

### Distill（蒸馏）

工具返回的结果可能很大（比如读取一个 1000 行的文件）。pi 内置了 distill 机制来压缩工具输出。pi-context-manager 扩展提供了：
- **自动 distill**：超过阈值（`/distill-config`）的工具输出自动压缩
- **首次全文上限**：`firstSeenCap`（`/distill-config --cap`）限制首次输出大小
- **Tool Result Processor**：特定工具类型的格式化精简（`/processor-config`）
- **Aging 淘汰**：自动淘汰旧工具输出（`/aging-config`）

### Tool Call 生命周期

```
1. AI 决定调用工具
     │
     ▼
2. Shepherd tool_call 钩子（rewrite / deny / notify）
     │
     ▼
3. 执行工具
     │
     ▼
4. Context Manager distill + processor 处理返回值
     │
     ▼
5. Shepherd tool_result 钩子（notify / steer）
     │
     ▼
6. 结果返回给 AI
```

### 会话存储

所有会话数据存储在 `~/.pi/agent/` 目录下：

```
~/.pi/agent/
├── settings.json         # 全局配置（安装扩展、provider）
├── mcp.json              # MCP server 配置
├── memory/               # 全局记忆文件（L1）
├── skills/               # 全局技能
├── extensions/           # 内联扩展
├── agents/               # 子代理定义
├── roadmaps/             # 全局路线图
├── npm/node_modules/     # npm 安装的扩展包
├── git/                  # git 包安装位置
└── distill/              # context-manager 的数据
    └── recordings/       # payload 录制文件

{project}/.pi/
├── settings.json         # 项目级配置（覆盖全局）
├── memory/               # 项目级记忆（L2）
└── roadmaps/             # 项目级路线图
```

## D. 常见问题

### Q: 安装扩展后不生效？

检查：
1. `settings.json` 格式是否正确（JSON 语法）
2. 包名是否拼写正确
3. 重启 pi（扩展需要重启才能加载）

### Q: 记忆文件太多怎么办？

pi-memory 会自动检查文件数量。超过 25 个时建议清理，超过 40 个会拒绝写入。清理方法：
1. 合并同主题的多文件
2. 删除过时的记忆
3. 大文件拆分为小文件

### Q: Shepherd 规则不生效？

检查：
1. 全局规则在 pi-shepherd 包的 `rules.json` 中
2. 项目规则放在 `.pi/shepherd-rules-*.json`（注意文件名前缀）
3. 确认规则中 `"enabled": true`
4. 输入 `/reload` 重新加载规则

### Q: Token 用得太快？

1. 用 `payload_analyze` 的 `budget` 和 `expensive` 模式找出 token 消耗大户
2. 用 compact 模式搜索（`semantic_code_search(compact: true)`）
3. 调低 distill 阈值（`/distill-config`）
4. 配置 aging 自动淘汰旧内容（`/aging-config`）

### Q: payload_analyze 报"无录制文件"？

需要先开启录制：`/record on`。录制期间正常使用，用完后 `/record off`。
