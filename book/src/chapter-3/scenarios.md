# 3.5 Shepherd 实战场景

> 这一节通过真实场景展示如何用 Shepherd 规则解决 AI 编码中的常见问题。

## 场景 1：编辑代码后自动提醒跑测试

### 问题

AI 改了 TypeScript 代码但忘了跑测试。你每次都得手动说"跑一下测试"。

### 规则

```json
{
	"comment": "[TypeScript] 编辑后必须跑测试",
	"hook": "tool_result",
	"tool": "edit",
	"action": "notify",
	"conditions": [
		{ "field": "path", "pattern": "\\.ts$", "flags": "" }
	],
	"reason": "编辑了 TypeScript 文件，必须跑覆盖该代码的单元测试（如无测试则先补充），修复所有测试问题确保通过。",
	"enabled": true
}
```

### 效果

```
AI：我修改了 src/auth/login.ts 的空值检查逻辑。
🛡️ Shepherd 提醒：编辑了 TypeScript 文件，必须跑覆盖该代码的单元测试。
AI：好的，我来跑测试... ✅ 3 个测试全部通过。
```

## 场景 2：防止 AI 乱改别人的代码

### 问题

你在 team 项目里工作，工作区有同事的未提交改动。AI 一看"这里不对"，顺手就 `git checkout` 恢复了别人的文件。

### 规则

```json
{
	"comment": "[安全] 禁止 git checkout 恢复文件",
	"hook": "tool_call",
	"tool": "bash",
	"action": "deny",
	"conditions": [
		{ "field": "text", "pattern": "git\\s+checkout\\s+--", "flags": "" }
	],
	"reason": "❌ 禁止 git checkout 恢复文件！工作区里有别人的未提交改动，你没有权力决定哪些改动是"无关"的。",
	"enabled": true
}
```

### 效果

```
AI 准备执行：git checkout -- src/config.ts
🛡️ Shepherd 阻止：禁止 git checkout 恢复文件！
AI：抱歉，我不会恢复别人的文件。让我看看其他方案...
```

## 场景 3：会话结束自动提交代码

### 问题

AI 改了一堆文件，会话结束了，但代码没提交。第二天发现工作区一团糟。

### 规则

```json
{
	"comment": "[收尾] 编辑后提醒 commit + 记忆更新 + 总结",
	"hook": "agent_end",
	"action": "notify",
	"check": "has_edits",
	"reason": "检测到文件编辑，执行收尾工作：\n1️⃣ Git commit...\n2️⃣ 更新记忆...\n3️⃣ 会话总结",
	"stopReason": ["stop"],
	"enabled": true
}
```

`check: "has_edits"` 确保只有真的改了文件才提醒，不会在纯聊天会话中干扰。`stopReason: ["stop"]` 确保只在 AI 正常结束时触发，被中断时不触发。

## 场景 4：编辑 .gd 文件后自动提醒跑架构检查

### 问题

你在做 Godot 游戏项目，AI 编辑了 `.gd` 文件后应该跑架构检查 + 格式化检查，但每次都得手动提醒。

### 规则（同一个文件可以有多条规则，按顺序执行）

```json
{
	"comment": "[arch] 编辑 .gd 文件后提醒跑编译验证",
	"hook": "tool_result",
	"tool": "edit",
	"action": "notify",
	"conditions": [
		{ "field": "path", "pattern": "\\.gd$", "flags": "" }
	],
	"reason": "编辑了 .gd 文件，请跑 check_arch 验证架构合规。",
	"enabled": true
},
{
	"comment": "[format] 编辑 .gd 文件后提醒跑格式化检查",
	"hook": "tool_result",
	"tool": "edit",
	"action": "notify",
	"conditions": [
		{ "field": "path", "pattern": "\\.gd$", "flags": "" }
	],
	"reason": "编辑了 .gd 文件，请跑 gdformat 格式化检查。",
	"enabled": true
}
```

两条规则都会触发，AI 会依次跑架构检查和格式化检查。

## 场景 5：工具反复出错时自动提醒翻记忆

### 问题

AI 在连续出错——edit 匹配失败、bash 命令找不到、测试反复不过。它在同一个死胡同里绕圈。

### 规则

```json
{
	"comment": "[debug] 工具反复出错时提醒翻记忆",
	"hook": "tool_result",
	"action": "steer",
	"state": { "countKind": "errors", "gte": 5 },
	"reason": "🔍 **工具反复出错**：连续失败多次，翻看 .pi/memory/ 目录下的记忆文件，看是否已有踩坑记录。",
	"enabled": true,
	"subagent": false
}
```

关键点：
- `state: { "countKind": "errors", "gte": 5 }` — 累计出错 5 次才触发，不会每次都提醒
- `action: "steer"` — 静默注入引导，不在用户界面显示
- `subagent: false` — 子代理中不触发，避免干扰独立任务

### 效果

```
AI 尝试 edit，失败...
AI 尝试 edit，失败...
AI 尝试 bash sed，失败...
AI 尝试 edit，失败...
AI 尝试 edit，失败...
🛡️ Shepherd 静默引导：翻看记忆文件。
AI：让我看看记忆... 找到了！记忆文件说"edit 匹配失败时先检查 CRLF"。
AI：运行 audit_format.py 检查格式... 果然是 CRLF 问题。
```

## 场景 6：自动改写高频命令

### 问题

AI 经常执行 `git status`、`git log`、`npm test` 等命令，这些命令的输出可能很长，浪费 token。

### 规则

```json
{
	"comment": "[rtk] 自动代理高频 bash 命令",
	"tool": "bash",
	"action": "rewrite",
	"pattern": "^(git\\s+(status|log|diff)|cargo\\s+(test|build|clippy)|pytest)\\b",
	"flags": "",
	"reason": "rtk command rewrite：自动加 rtk 前缀压缩输出",
	"enabled": true
}
```

当 AI 执行 `git status` 时，Shepherd 自动改写为 `rtk git status`（rtk 是一个输出压缩工具），减少 token 消耗。AI 不需要知道这个改写——对它来说，执行结果就是更简洁了。

## 规则设计模式总结

| 模式 | 动作 | 适用场景 |
|------|------|----------|
| **编辑后提醒** | `notify` + `conditions` | 改代码后跑测试、lint、格式化 |
| **危险操作阻止** | `deny` + `conditions` | 禁止 `git checkout`、禁止删文件 |
| **收尾自动化** | `agent_end` + `check` | 会话结束自动 commit + 记忆更新 |
| **连续出错引导** | `steer` + `state` | 反复失败时引导翻记忆 |
| **命令改写** | `rewrite` + `pattern` | 自动给命令加前缀压缩输出 |

> 📖 回到 [3.1 给 AI 立规矩](./rules.md) 看完整的规则字段说明。
