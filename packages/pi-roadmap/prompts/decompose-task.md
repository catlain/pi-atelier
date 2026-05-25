# Task 拆解指导

你将一个 Story 拆解为具体的可执行 Task。

## 输入
Story: {{storyTitle}}
描述: {{storyDescription}}

## 拆解原则

1. **每个 Task 是 30 分钟 - 2 小时能完成的最小工作单元**
2. **Task 标题必须是动词开头**，一看就知道要做什么
3. **Task 不需要描述**——标题足够清楚
4. **Task 不再有子任务**——这是最底层

## 每个 Task 必须包含
- id: "E1.S1.T1", "E1.S1.T2", ...（父 Story 编号 + 顺序号）
- title: 动词开头，如"写 README 的安装章节"、"提取 memory 扩展代码"
- status: "todo"

## 拆解示例
Story: "文档与发布准备" →
  T1: "写整体 README（项目介绍、功能列表、截图）"
  T2: "写安装指南（npm install + 配置步骤）"
  T3: "写 API 文档（工具列表 + 参数说明）"
  T4: "配置 npm publish 自动化"
  T5: "发布到 npm 并验证安装"

## 常见错误
- ❌ Task 太模糊（"写文档"）→ 改为具体动词（"写 README 的安装章节"）
- ❌ Task 太大（超过 2 小时）→ 拆成更小的 Task
- ❌ Task 实际是一个 Story → 降级粒度
- ❌ Task 标题不是动词开头 → 必须动词开头
