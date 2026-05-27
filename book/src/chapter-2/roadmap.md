# 从记忆到规划

## 你可能遇到过这种情况

你让 AI 做一个"把项目从 JavaScript 迁移到 TypeScript"的大任务。

前 30 分钟一切顺利——AI 按计划迁移了配置文件、类型定义、核心模块。但到第 5 个文件的时候，AI 开始"跑偏"：

- 它忘了之前的约定，开始用不同的命名风格
- 它跳过了测试文件的迁移
- 它开始做一个你没要求的"顺便重构"
- 当你提醒它回到正轨，它已经不记得原计划的前 3 步是什么了

> 💡 **金鱼记忆解决了，但还有"注意力涣散"问题**：AI 记得住知识，但管不住任务。

## 路线图：让 AI 学会管理复杂任务

pi-roadmap 给 AI 装上了"项目管理大脑"：

- **结构化拆解**：把大目标拆成 Epic → Story → Task 三层
- **进度追踪**：每个任务有明确的状态（todo / doing / done / blocked）
- **持久化**：路线图保存在文件中，新会话也能继续推进
- **优先级排序**：自动推荐下一步该做什么

### 为什么是三层结构？

```
Epic（大方向）
 └── Story（可交付的工作块）
      └── Task（最小执行单元）
```

这个结构来自敏捷开发的实践，但做了一点适配：

| 概念 | 传统敏捷 | pi-roadmap | 理由 |
|------|----------|------------|------|
| Epic | 2-8 周 | 一个完整项目方向 | AI 会话不会持续几周 |
| Story | 1-3 天 | 1-3 个会话可完成 | 适配 AI 的工作节奏 |
| Task | 0.5-1 天 | 30 分钟 - 2 小时 | AI 单次能专注的粒度 |

### 工作原理

```
用户描述目标
     │
     ▼
┌──────────────────────────────────┐
│         roadmap_plan             │
│  AI 分析目标 → 拆解为三层结构      │
│  对比已有路线图 → 增量更新          │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  ~/.pi/roadmap/<id>.roadmap.json │
│  全局存储，跨会话跨项目可用         │
│  + 项目级 .pi/roadmap/roadmap.json│
│    （自动同步派生）                │
└──────────────┬───────────────────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
 roadmap_list  roadmap_show  roadmap_next
  查看所有     查看详情     推荐下一步
```

## 实际案例：迁移一个多包项目

让我们看一个真实的场景——把 12 个 npm 包同时做文档升级：

### 步骤 1：创建路线图

你说："帮我规划一下给所有包写文档的工作。"

AI 调用 `roadmap_plan`，自动拆解：

```json
{
  "roadmapId": "package-docs",
  "title": "包文档升级",
  "epics": [
    {
      "id": "E0",
      "title": "制定模板并验证",
      "stories": [
        {
          "id": "E0.S0",
          "title": "分析最佳实践，提炼模板",
          "tasks": [
            { "id": "E0.S0.T0", "title": "调研 GitHub 文档规范" },
            { "id": "E0.S0.T1", "title": "提炼 README 模板" },
            { "id": "E0.S0.T2", "title": "用第一个包验证模板" }
          ]
        }
      ]
    },
    {
      "id": "E1",
      "title": "批量升级所有包",
      "stories": [
        { "id": "E1.S0", "title": "核心扩展（4个包）" },
        { "id": "E1.S1", "title": "工具扩展（4个包）" },
        { "id": "E1.S2", "title": "辅助扩展（4个包）" }
      ]
    }
  ]
}
```

### 步骤 2：按计划推进

每次新会话，你说"继续"。AI 调用 `roadmap_next`：

```
📊 推荐下一步任务：

E0.S0.T1 — 提炼 README 模板（high priority）
  所属：E0 制定模板并验证 > S0 分析最佳实践

是否开始？
```

### 步骤 3：完成标记

AI 完成一个任务后，调用 `roadmap_done`：

```
✅ E0.S0.T1 已完成
   产出：templates/README-template.md
```

### 步骤 4：遇到阻碍

如果某个包的源码缺失，AI 可以标记任务为 blocked：

```
⚠️ E1.S1.T3 已阻塞
   原因：pi-journal 的 API 文档不完整，需要先补充源码注释
```

## 路线图 vs 记忆：什么关系？

| 维度 | 记忆（pi-memory） | 路线图（pi-roadmap） |
|------|-------------------|---------------------|
| 存什么 | 知识、决策、踩坑 | 任务、进度、计划 |
| 粒度 | 自由文本 | 结构化 JSON |
| 查询方式 | 关键词 | 状态/优先级 |
| 生命周期 | 长期保留 | 项目结束可归档 |

简单来说：

- **记忆**是"我知道什么"
- **路线图**是"我要做什么、做到哪了"

两者互补：记忆帮 AI 不忘知识，路线图帮 AI 不忘任务。

## 最佳实践

### ✅ 好的 Epic 拆解

```
Epic: 发布 npm 包
  Story: 准备发布环境
    Task: 配置 package.json 的 exports 字段
    Task: 添加 bundledDependencies 配置
    Task: 配置 tsconfig 的 declaration 输出
  Story: 编写文档
    Task: 完成 README.md
    Task: 添加 CHANGELOG.md
```

### ❌ 不好的拆解

```
Epic: 把所有事情做完        ← 太模糊，没有方向
  Story: 做第一步            ← 没说做什么
    Task: 开始干活            ← 无法执行
```

### 拆解的黄金法则

1. **Epic 的标题应该是一个动词短语**："发布 npm 包"而不是"npm"
2. **Story 应该有明确的交付物**："完成 README"而不是"写文档"
3. **Task 应该 30 分钟内可执行**："配置 package.json 的 name 字段"而不是"配置构建"
4. **同层级的项应该是同粒度**：不要一个 Story 有 2 个 Task，另一个有 20 个

## 进阶场景：计划调整与进度追踪

### 场景：需要改变方向

计划赶不上变化。昨天规划好的路线图，今天发现需求变了。你不需要重新建一个——用 `roadmap_plan` 更新即可：

```
你：昨天规划的重构方案太大了，我想先只做认证模块。

AI 调用 roadmap_plan(action="update")：
  → 对比当前路线图和你的新需求
  → 保留已完成的任务不动
  → 标记不需要的任务为 dropped
  → 添加新的任务
```

**关键原则**：`roadmap_plan` 是增量更新，不是覆盖。已经 `done` 的任务永远不会被改回去。

### 场景：追踪谁做了什么

在多会话协作中，你经常想知道"这个 task 是哪个会话完成的？"Roadmap 自动追踪：

```
roadmap_show(roadmapId="package-docs")

结果：
  E0.S0.T0 调研 GitHub 文档规范 ✅ by: 8740-8fce3e7af232
  E0.S0.T1 提炼 README 模板 ✅ by: b8b5-85516ead6253
  E0.S0.T2 用第一个包验证模板 ✅ by: b8b5-85516ead6253
  E1.S0.T0 核心扩展 - pi-shepherd 🔄 doing by: aa55-a4860e851afb
```

每个完成的 task 后面的 `by: xxxx-xxxxxxxxxxxx` 是会话 ID 的短格式（UUID 最后两段）。你可以用这个 ID 搜索到具体的会话：

```
session_search(action="grep", query="8740-8fce3e7af232")

→ 找到该会话，然后用 session_analyze(action="summary") 查看详情
```

### 场景：归档已完成的 Epic

项目做完了，不想让已完成的 Epic 占据视线：

```
roadmap_archive(roadmapId="package-docs")

→ 自动归档所有已完成的 Epic
→ 默认隐藏，需要时用 show_archived=true 查看
```

### 场景：不知道下一步做什么

打开 pi 时不知道该继续什么：

```
roadmap_next()

结果：
  📊 推荐下一步任务（按优先级排序）：
  
  1. E1.S0.T3 — 配置 package.json 的 files 白名单 (high, todo)
  2. E1.S1.T0 — 工具扩展 - pi-roadmap (medium, todo)
  3. E2.S0.T0 — 调研 mdBook 主题定制 (low, todo)
```

`roadmap_next` 自动按 doing → todo、high → medium → low 排序，告诉你最该做什么。

## 下一步

AI 有了记忆（记住知识）和路线图（管理任务）。但有时候，AI 还是会"犯错"——改不该改的文件、用不该用的方式。

下一章，我们来看如何给 AI **立规矩**。
