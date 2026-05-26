# 附录

## A. 扩展速查表

| 扩展 | 安装命令 | 核心工具 | 一句话用途 |
|------|----------|----------|-----------|
| pi-memory | `"pi-memory"` | `memory_update`, `memory_index` | 跨会话知识持久化 |
| pi-roadmap | `"pi-roadmap"` | `roadmap_plan`, `roadmap_next`, `roadmap_done` | 任务拆解和进度追踪 |
| pi-shepherd | `"pi-shepherd"` | 钩子规则引擎 | AI 行为守卫 |
| pi-context | `"pi-context"` | distill + 过滤 | 上下文质量控制 |
| pi-journal | `"pi-journal"` | 自动记录 | 会话日志 |
| pi-session-analyzer | `"pi-session-analyzer"` | `session_search`, `session_analyze` | 历史会话搜索和分析 |
| pi-smart-compact | `"pi-smart-compact"` | 两阶段压缩 | 长会话保持质量 |
| pi-payload-analyzer | `"pi-payload-analyzer"` | `payload_analyze` | Token 诊断 |
| pi-scheduler | `"pi-scheduler"` | `schedule` | 定时任务和提醒 |
| pi-workflow | `"pi-workflow"` | 子代理编排 | 复杂研究自动化 |
| pi-shared-utils | `"pi-shared-utils"` | logger, storage, paths, json, validator | 扩展开发工具库 |

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
    "pi-journal",
    "pi-session-analyzer",
    "pi-smart-compact"
  ]
}
```

加上规矩、日志和复盘能力。

### 大型重构（全量组合）

```json
{
  "packages": [
    "pi-memory",
    "pi-roadmap",
    "pi-shepherd",
    "pi-context",
    "pi-journal",
    "pi-session-analyzer",
    "pi-smart-compact",
    "pi-payload-analyzer",
    "pi-scheduler",
    "pi-workflow"
  ]
}
```

全量安装，充分利用自动化和诊断能力。

## C. pi 内部机制速览

### Compaction（压缩）

pi 内置了上下文压缩机制。当对话历史接近上下文窗口上限时，pi 会自动压缩旧对话。Smart Compact 扩展增强了这个机制——它会识别关键信息（决策、约定、结论）优先保留。

### Distill（蒸馏）

工具返回的结果可能很大（比如读取一个 1000 行的文件）。pi 内置了 distill 机制来压缩工具输出。pi-context 扩展可以自定义 distill 策略。

### Tool Call 生命周期

```
1. AI 决定调用工具
     │
     ▼
2. Shepherd 钩子检查（before_*）
     │
     ▼
3. 执行工具
     │
     ▼
4. Context distill 处理返回值
     │
     ▼
5. Shepherd 钩子检查（after_*）
     │
     ▼
6. 结果返回给 AI
```

### 会话存储

所有会话数据存储在 `.pi/sessions/` 目录下：

```
.pi/
├── memory/          # pi-memory 的记忆文件
├── roadmaps/        # pi-roadmap 的路线图 JSON
├── sessions/        # 会话原始数据
├── journal/         # pi-journal 的日志
└── config.json      # 项目级配置
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

检查 `rules.json` 的格式和位置。规则文件应该在项目的 `shepherd/rules.json` 或全局的 `~/.pi/agent/shepherd/rules.json`。

### Q: Token 用得太快？

用 `payload_analyze` 的 `budget` 和 `expensive` 模式找出 token 消耗大户，然后用 compact 模式搜索或 distill 来减少消耗。
