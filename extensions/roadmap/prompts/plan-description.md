路线图计划工具：从讨论内容中提炼计划，对比已有 roadmap，拆解为 Epic→Story→Task 三层结构。

## 使用场景
- 用户说"讨论计划"、"拆解一下"、"我们规划一下"、"调整路线图"时调用
- 用户描述了大方向或做了调整，需要落地为可执行任务时调用
- 用户确认了某个讨论结果，需要写入路线图时调用

## 操作流程（必须按顺序执行）

### 第 1 步：读取现状
- 如果是更新，先用 roadmap_show 查看当前 roadmap 的完整内容
- 如果是新建，跳过此步

### 第 2 步：分析讨论内容
对照已有的 roadmap（如果有的话），从用户当前会话的讨论中提炼：
- **新增意图**：用户提出了之前没有的方向或任务
- **调整意图**：用户修改了已有计划（改优先级、改拆解方式、合并/拆分）
- **删除意图**：用户决定不做某事了
- **确认意图**：用户确认了之前不确定的事项

### 第 3 步：差异对比（关键！）
将讨论提炼的意图与已有 roadmap 对比：
- 已有 Epic/Story/Task 中，哪些与讨论一致 → 保留
- 哪些被讨论修改 → 更新
- 哪些被讨论否定 → 标记 dropped
- 哪些是全新的 → 按拆解规则创建

差异分析时参考 prompts/plan-diff.md 的指导。

### 第 4 步：拆解
将新增/修改的部分按以下规则拆解：

**Epic 层**（大方向 → Epic）：
- 每个 Epic 对应一个项目，有独立交付价值
- 标题动词开头，如"发布 pi-memory npm 包"
- 2-8 周完成粒度
- 详细规则参考 prompts/decompose-epic.md

**Story 层**（Epic → Story）：
- 1-3 天可完成的工作块
- 有明确交付物和验收标准
- 详细规则参考 prompts/decompose-story.md

**Task 层**（Story → Task）：
- 30 分钟 - 2 小时的最小工作单元
- 标题动词开头，一看就知道要做什么
- 详细规则参考 prompts/decompose-task.md

### 第 5 步：输出格式
调用本工具写入时，content 参数必须是完整的 roadmap JSON（不只是变更部分）。
格式规范参考 prompts/plan-output-format.md。

## 参数说明
- roadmapId: 路线图 ID（slug 格式，如 "pi-atelier-split"）
- content: 完整的 roadmap JSON 对象（包含所有 Epic/Story/Task）
- action: "create"（新建）或 "update"（更新已有）

## 重要约束
- 已有的 done 状态任务保持原样（不改状态、不改内容）
- 只修改 todo/doing/blocked 状态的项
- 每个 Epic 必须有 project 字段指向实际项目
- Task 是最底层，不能再嵌套子任务
