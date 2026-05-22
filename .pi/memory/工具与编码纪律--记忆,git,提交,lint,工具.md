# pi 工具与编码纪律

关键词：`记忆` `git` `提交` `lint` `工具` `纪律`

## 记忆管理

- 纯文件 3 级记忆系统（已卸载 mempalace 向量搜索）
- L1=`~/.pi/agent/MEMORY.md`（跨项目通用记忆索引）
- L2=`{project}/.pi/memory/*.md`（项目级主题记忆）
- L3=会话上下文（本轮工作记忆）

### 记忆长度规范

- **单文件上限 80 行**。超过必须拆分为多个主题文件
- **每个文件一个主题**，用标题清楚描述内容
- 拆分后更新 MEMORY.md 索引（L1 或 L2），确保描述准确
- `memory_update` 工具写入前先检查目标文件行数，超过 80 行的需拆分再写
- 历史演变记录（bug 修复过程、多次迭代）属于"踩坑/反馈"类，应独立文件；架构文档只保留最终结论

## git 提交纪律

- Turn 结束前必须提交
- 提交前 `git diff` 审查所有变更
- 如果在 worktree 中，提交后打印合并提醒（不要自动合并）

## lint 规则

- 发现即修复，不管是不是你引入的
- Python 文件编辑后建议 `ruff check <file>`
- Rust 文件编辑后建议 `cargo clippy`
- 接口文件修改后 `uv run python scripts/check_arch.py`

## 重构纪律

- **拆分/精简文件前必须 grep 确认所有功能都有归属**。env-and-status 从 279 行拆到 39 行时丢失了 GLM_API_KEY 模块顶层注入，导致 MCP 服务全面不可用
- **副作用代码（环境变量注入、全局初始化）不适合拆到子模块**——`import` 时机不确定，应在入口文件顶层立即执行
- 拆分后立即运行全量测试 + 热路径手动验证（如 MCP 连接、记忆注入）

## 历史决策

- 卸载了 pi-subagents（~3500 tokens），PV 通过 runSubagent() 自己 spawn pi
- 卸载了 pi-package-search、pi-resource-center
- 卸载了 mempalace 扩展（2026-05-08），改用纯文件 3 级记忆

## pi 扩展 reload vs restart

改了扩展源码（.ts 文件）后，**reload 即可**——pi 通过 jiti 运行时编译 TS，reload 会重新加载。不需要完全重启。但改了依赖结构（加 file: 链接、删文件）建议 reload 后验证加载是否正常。
