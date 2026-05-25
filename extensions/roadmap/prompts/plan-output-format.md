# 路线图 JSON 格式规范

roadmap_plan 的 content 参数必须是合法 JSON，遵循以下格式：

```json
{
  "meta": {
    "id": "slug 格式，小写字母+数字+短横线",
    "title": "中文标题",
    "status": "active | paused | completed",
    "created": "ISO 日期",
    "updated": "ISO 日期",
    "tags": ["标签1", "标签2"]
  },
  "epics": [
    {
      "id": "E1",
      "title": "动词开头的标题",
      "description": "描述",
      "status": "todo | doing | done | blocked | dropped",
      "priority": "high | medium | low",
      "project": "项目路径（必填）",
      "stories": [
        {
          "id": "E1.S1",
          "title": "Story 标题",
          "description": "描述",
          "status": "todo",
          "tasks": [
            {
              "id": "E1.S1.T1",
              "title": "动词开头的 Task",
              "status": "todo"
            }
          ]
        }
      ]
    }
  ]
}
```

## 格式检查清单
- [ ] meta.id 是合法 slug（小写+数字+短横线）
- [ ] meta.status 是 active | paused | completed 之一
- [ ] Epic id 唯一（E1, E2, ...）
- [ ] Story id 在 Epic 内唯一（E1.S1, E1.S2, ...）
- [ ] Task id 在 Story 内唯一（E1.S1.T1, E1.S1.T2, ...）
- [ ] 所有 status 是合法枚举值
- [ ] Task 是最底层，无嵌套子任务
- [ ] 已有的 done 任务保持原样
- [ ] 每个 Epic 有 project 字段
