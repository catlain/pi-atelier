# Roadmap 扩展架构

`关键词` `roadmap` `Epic` `Story` `Task` `JSON存储` `提示词模板`

## 核心设计决策

- **JSON 存储**（非 Markdown）：解析可靠，格式验证简单，修复容易
- **三层严格不嵌套**：Epic → Story → Task，Task 是最底层
- **全局 + 项目双级**：`~/.pi/roadmap/*.roadmap.json`（全局）+ `.pi/roadmap/roadmap.json`（项目级派生数据）
- **提示词外置**：`prompts/*.md` 文件，方便修改拆解质量

## 文件结构

```
extensions/roadmap/
├── index.ts              # 入口：hook + 工具注册
├── lib/
│   ├── types.ts          # 类型 + 常量（GLOBAL_ROADMAP_DIR 等）
│   ├── validator.ts      # JSON 验证 + 修复（独立于 store）
│   ├── store.ts          # 读写 + 归档（≤200行）
│   ├── progress.ts       # 进度计算 + next 提取
│   ├── parser.ts         # 查询/过滤
│   ├── planner.ts        # 提示词加载 + {{变量}} 替换
│   ├── sync.ts           # 全局→项目同步
│   ├── injector.ts       # before_agent_start 注入文本
│   ├── tools-query.ts    # roadmap_list + roadmap_show
│   ├── tools-plan.ts     # roadmap_plan
│   └── tools-action.ts   # roadmap_next + roadmap_done
├── prompts/              # 6 个拆解/分析提示词模板
└── tests/                # 53 个单元测试
```

## 关键 API 模式

- 工具注册：必须 `label` 字段，`execute(id, params, signal, onUpdate, ctx)` 5 参数
- 返回格式：`{ content: [{ type: "text", text }], details: {} }`
- Hook：`pi.on("before_agent_start", ...) → { systemPrompt: "..." }`
- 提示词加载：`planner.ts` 的 `loadPrompt()` + `buildPrompt(template, vars)` 参考 plan-verify 的 `loadTaskTemplate`

## 待完成

- [ ] Step 4: arch-code-review
- [ ] Step 5: 更新 docs/agent/ 文档
- [ ] 实际使用验证（创建第一个 roadmap）
