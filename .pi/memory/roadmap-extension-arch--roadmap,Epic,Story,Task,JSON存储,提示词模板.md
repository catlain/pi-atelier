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
│   ├── store.ts          # 读写 + 归档
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
- 提示词加载：`planner.ts` 的 `loadPrompt()` + `buildPrompt(template, vars)`

## 构建与加载

- **不需要 build**：pi 用 jiti 直接加载 TypeScript 源码
- **package.json 格式**：`"type": "commonjs"` + `"main": "dist/index.js"`（占位，实际不走 dist）
- **tsconfig**：继承 `tsconfig.base.json`
- **注册方式**：`settings.json` 的 packages 中加 `+extensions/roadmap/index.ts`
- **pi.extensions**：`package.json` 中 `pi.extensions` 数组自动发现，但 settings 显式列表优先

## 开发流程记录

- 按 safe-change feature workflow 走完全部 5 步（Preflight → Design → TDD → Code Review → Docs Update）
- arch-code-review 发现 6 个问题，修复 5 个，1 个 workaround（`pi.on as any` 跟 memory 扩展一致）
- 5 个架构文档已更新（REPO_INVENTORY, ARCHITECTURE, DATA_MODEL, CHANGE_GUIDE, RISK_REGISTER）

## 待验证

- [ ] pi 启动加载验证（工具是否注册成功）
- [ ] 创建第一个 roadmap（pi-atelier 拆分 / 量化三线）
- [ ] before_agent_start 注入效果
