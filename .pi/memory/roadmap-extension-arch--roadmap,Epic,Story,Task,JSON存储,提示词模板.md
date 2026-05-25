# roadmap 扩展架构决策

关键词：`roadmap` `Epic` `Story` `Task` `JSON存储` `提示词模板`

## 数据模型

- **三层结构**：Epic → Story → Task，严格不嵌套（Task 无子节点）
- **存储**：JSON 文件（`~/.pi/roadmap/<id>.roadmap.json`），唯一真相源
- **项目级同步**：全局 roadmap 中 project 匹配当前项目的 Story → 同步到 `.pi/roadmap/roadmap.json`
- **归档**：完成的 roadmap 移入 `archive/` 子目录
- **Epic 必须有 project 字段**

## 优先级继承机制

- Epic：priority 必填（high/medium/low）
- Story：priority 可选，缺省继承 Epic
- Task：priority 可选，缺省继承 Story → Epic
- **公共函数** `getEffectivePriority(own?, parent?) → Priority`：自身优先 → 父级 → medium
- **公共函数** `comparePriority(a, b) → number`：用于 sort()
- progress.ts 的排序统一使用这两个函数，不内联 priority 比较逻辑

## 提示词体系

```
prompts/
├── plan-description.md    # roadmap_plan 工具描述（= AI 操作指南）
├── plan-diff.md           # 差异分析（对比已有计划 vs 讨论内容）
├── decompose-epic.md      # 大方向 → Epic 拆解规则
├── decompose-story.md     # Epic → Story 拆解规则
├── decompose-task.md      # Story → Task 拆解规则
└── plan-output-format.md  # JSON 格式规范（AI 必须遵守）
```

- `plan-description.md` 作为 `registerTool` 的 `description` 字段，AI 每次调用前看到
- 其他模板由 planner.ts 的 `loadPrompt` + `buildPrompt` 按需加载，用 `{{变量}}` 占位符
- 参考 plan-verify 的 `loadTaskTemplate` 模式

## 注入方式（已移除）

- ~~session_start + setWidget~~ → 移除（拖慢 reload）
- ~~before_agent_start + message.display~~ → 移除（用户不需要自动弹出）
- **改为纯按需查询**：用户说"有什么计划"时调 `roadmap_list`/`roadmap_next`

## 踩坑记录

### require() 解构赋值不检查函数名

`require("./lib/xxx")` 的解构赋值不受 TypeScript 类型检查，写错函数名编译不报错，运行时才炸。
- `calcProgress` 错写成 `calculateProgress`（两处遗漏）
- `progress` 错写成 `percent`（变量名不一致）
- **教训**：require() 动态导入后，立即验证返回值类型，或改用 ESM import

### Type.Any() 参数陷阱

LLM 可能把 JSON 对象作为字符串传递（而非对象）。`tools-plan.ts` 的 `execute` 中需要 `JSON.parse` 兜底：
```ts
const content = typeof params.content === 'string' ? JSON.parse(params.content) : params.content;
```

### setWidget 的参数类型

- `ctx.ui.setWidget(key, string[])` — 简单字符串数组
- `ctx.ui.setWidget(key, renderFunction)` — 渲染函数（参考 scheduler 扩展）
- 需要用 `ctx.ui` 而非 `pi`，且仅在 hook 回调中有 `ctx` 参数

## 状态

- ✅ 5 个工具全部可用（list/show/plan/next/done）
- ✅ 53 个单元测试通过
- ✅ 两个路线图已录入（pi-atelier 拆分 + 量化三线）
- ✅ 自动注入已移除（纯按需查询）
