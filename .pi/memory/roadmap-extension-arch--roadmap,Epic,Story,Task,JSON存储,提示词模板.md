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

- [x] pi 启动加载验证（工具注册成功）
- [x] 创建两个 roadmap（pi-atelier 拆分 5E/9S/33T + 量化三线 3E/12S/43T）
- [ ] before_agent_start 可见消息渲染（改用 message.display + registerMessageRenderer）

## 踩坑记录

### require() 绕过类型检查
index.ts 中用 `require("./lib/progress")` 做动态导入，函数名写错（`calculateProgress` vs 实际导出名 `calcProgress`），TS 编译不报错，运行时才崩。**教训**：require() 的解构赋值一定先用 `code_graph_module_overview` 或 grep 确认实际导出名。

### Type.Any() 参数陷阱
`roadmap_plan` 的 `content` 参数用 `Type.Any()`，LLM 可能传字符串而非对象。需要在 execute 中加 `JSON.parse` 兜底。详见记忆 `mcp_tool_traps`。

### 注入方式
初始用 `systemPrompt` 注入（用户不可见），改为 `message.display: true` + `registerMessageRenderer` 后用户在 TUI 可看到路线图概览。
