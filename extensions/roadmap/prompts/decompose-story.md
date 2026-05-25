# Story 拆解指导

你将一个 Epic 拆解为 3-7 个 Story。

## 输入
Epic: {{epicTitle}}
描述: {{epicDescription}}
项目: {{project}}

## 拆解原则

1. **每个 Story 是 1-3 天可完成的工作块**
2. **Story 有明确的交付物**：完成时能产出具体的文件/功能/文档
3. **Story 之间可以有依赖，但要在描述中标注**
4. **Story 不再标记 project**（继承 Epic 的 project）

## 每个 Story 必须包含
- id: "E1.S1", "E1.S2", ...（父 Epic 编号 + 顺序号）
- title: 名词短语，如"文档与发布准备"、"核心模块拆分"
- description: 输入是什么、产出是什么、验收标准
- status: "todo"
- tasks: []（初始为空，后续用 decompose-task 进一步拆解）

## 拆解思路
按以下维度选择最适合的拆法：
- **按工作类型分**：文档、开发、测试、发布
- **按模块分**：如果 Epic 涉及多个独立模块
- **按阶段分**：准备 → 实现 → 验证 → 收尾

## 常见错误
- ❌ Story 太大（超过 3 天）→ 拆成更小的 Story
- ❌ Story 太小（不到半天）→ 合并到相邻 Story
- ❌ Story 之间有隐含依赖没标注 → 明确标注
- ❌ Story 缺少验收标准 → description 中必须说清"做完什么样"
