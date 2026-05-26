# README 模板规范

pi-atelier 开源包的 README 统一模板。基于 [pi-memory](https://github.com/catlain/pi-memory) README 提炼。

## 设计原则

1. **自包含**：README 是唯一的入口文档，不依赖外部链接即可理解包的全部功能
2. **AI 友好**：代码块用 ASCII/mermaid 而非纯文字描述流程；表格用于结构化数据
3. **渐进式**：从"为什么"到"怎么用"到"高级配置"，读者按需深入
4. **诚实**：限制和已知问题必须写明，不做虚假承诺

## 必选章节（按顺序）

### 1. 标题 + 一句话描述 + Badge

```markdown
# pi-xxx

[一句话描述，动词开头，点明核心价值]。为 [pi](https://github.com/earendil-works/pi-coding-agent) 提供 [能力]。

[![npm version](https://img.shields.io/npm/v/@pi-atelier/xxx.svg)](https://www.npmjs.com/package/@pi-atelier/xxx)
[![license](https://img.shields.io/github/license/catlain/pi-xxx.svg)]()
```

**要点**：
- 包名即标题，不加多余修饰
- 第一句话就说清楚"它是什么 + 解决什么问题"
- Badge 可选但推荐（npm version、license）

### 2. 为什么需要它 / What It Does（2-5 句话）

```markdown
## 为什么需要它

[痛点描述 — AI agent 遇到什么问题]
[解决方案 — 本包如何解决]
[3-5 个核心特性，用列表或表格]
```

**要点**：
- 先说痛点，再说方案
- 用场景而不是技术术语开头

### 3. 工作原理（必选）

```markdown
## 工作原理

​```
[ASCII 流程图，展示核心工作流]
​```

**核心机制**：
- **[机制1]**：[一句话解释]
- **[机制2]**：[一句话解释]
```

**要点**：
- ASCII 流程图让读者 5 秒理解整体架构
- 核心机制用加粗列表，每条不超过一行

### 4. 安装（必选）

```markdown
## 安装

​```bash
pi install git:github.com/catlain/pi-xxx
​```

重启 pi 即可使用。无需额外配置。

> **前提**：已安装 [pi](https://github.com/earendil-works/pi-coding-agent)。
```

### 5. 提供的工具 / API 参考（必选）

这是 README 的核心部分，占最大篇幅。

```markdown
## 提供的工具

### `tool_name` — [简短描述]

[2-3 句话说明功能和触发场景]

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| xxx  | string | 是 | [说明] |
| yyy  | number | 否 | [说明，含默认值] |

**输出示例**：
​```
[工具返回的实际格式]
​```

**Agent 什么时候用**：
- [场景1]
- [场景2]
```

**要点**：
- 每个工具单独一节
- 参数表是核心，必须完整
- 必须有"Agent 什么时候用"引导 LLM 正确调用
- 如果工具涉及复杂流程（如写入、冲突检测），用有序列表展示流程

### 6. 配置（如可配置）

```markdown
## 配置

​```json
{
  "xxx": {
    "option1": "value1",
    "option2": true
  }
}
​```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| option1 | string | `"default"` | [说明] |
```

**要点**：
- 只有可配置的包才需要此章节
- 必须给出默认值

### 7. 限制（必选）

```markdown
## 限制

| 限制 | 值 | 说明 |
|------|---|------|
| [限制名] | [值] | [影响] |
```

**要点**：
- 如实写明所有限制
- 表格形式一目了然

### 8. 最佳实践（推荐）

```markdown
## 最佳实践

### ✅ 推荐做法
- [做法1]
- [做法2]

### ❌ 不推荐做法
- [做法1]
- [做法2]
```

### 9. 架构（必选）

```markdown
## 架构

​```
extensions/xxx/
├── index.ts              # 入口：注册工具 + hooks
├── lib/
│   ├── types.ts          # 类型定义和常量
│   ├── core-logic.ts     # 核心逻辑
│   └── helper.ts         # 辅助函数
├── prompts/
│   └── tool-desc.md      # 工具描述（LLM 可见）
└── package.json
​```

**依赖**：
- `@earendil-works/pi-coding-agent` — ExtensionAPI
- [其他依赖，说明用途]
```

**要点**：
- 目录树 + 一行注释说明每个文件的作用
- 列出依赖和用途

### 10. 许可证（必选）

```markdown
## 许可证

MIT
```

## 可选章节

- **Examples**：如果有多种使用模式，加在"安装"之后、"工具"之前
- **文件格式**：如 pi-memory 的文件命名/内容规范，加在"工具"之后
- **FAQ**：常见问题，放在"限制"之后
- **与其他扩展配合**：生态协同，放在末尾

## 行数参考

| 包类型 | 目标行数 | 说明 |
|--------|---------|------|
| 简单工具包（1-2 个工具） | 80-120 | pi-scheduler 级别 |
| 中等功能包（2-4 个工具） | 120-180 | pi-roadmap 级别 |
| 复杂功能包（4+ 工具/多概念） | 180-250 | pi-memory 级别 |

**底线**：不低于 80 行，不超过 300 行。超过 300 行考虑拆分为 README + docs/。
