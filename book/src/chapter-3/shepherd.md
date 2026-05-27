# 3.2 pi-shepherd 原理：规则驱动的钩子系统

> Shepherd 是 pi-atelier 的"神经系统"——它不提供工具或命令，而是通过事件钩子连接所有其他扩展。

## 架构概览

```
pi 事件总线
     │
     ├─ before_provider_request  ← Shepherd 在此注入临时提示
     │
     ├─ tool_call                ← Shepherd 拦截/改写工具调用
     │      │
     │      ▼
     │   工具执行
     │      │
     │      ▼
     ├─ tool_result              ← Shepherd 检查结果、触发后续动作
     │
     ├─ agent_end                ← Shepherd 触发收尾工作
     │
     └─ session_shutdown         ← Shepherd 清理临时状态
```

## 核心概念

### 规则（Rule）

每条规则是一个 JSON 对象，定义了"**什么时机**、**什么条件**、**做什么动作**"：

```
规则 = 钩子时机(hook) + 匹配条件(conditions/pattern) + 动作(action) + 提示(reason)
```

### 动作类型详解

| 动作 | 注入方式 | 用户可见 | 典型用途 |
|------|----------|----------|----------|
| `notify` | 注入到 AI 上下文 | ✅ 是 | 提醒 AI 跑测试、lint |
| `steer` | 静默注入 | ❌ 否 | 引导 AI 查阅规范 |
| `rewrite` | 修改工具参数 | ✅ 是 | 自动给命令加前缀 |
| `deny` | 阻止执行 | ✅ 是 | 禁止危险操作 |

### 状态追踪（State）

Shepherd 内部维护了工具调用的状态计数器：

```json
"state": { "countKind": "errors", "gte": 5 }
```

这表示"累计错误 ≥ 5 次时触发"。`countKind` 支持：
- `"errors"`：工具返回错误时计数
- `"calls"`：工具被调用时计数

### 跨扩展通信

Shepherd 通过 `pi.events` 事件总线接收其他扩展的"提示"（hint）：

```
其他扩展发出 hint → pi.events.emit("ephemeral:hint") → Shepherd 收集
                                                                 │
before_provider_request 时 → Shepherd 把收集的 hints 注入 AI 上下文
```

这种机制让扩展之间可以协作而不需要直接依赖。

## 规则加载流程

```
1. 加载扩展包内的 rules.json（全局默认规则）
     │
     ▼
2. 扫描项目目录下的 .pi/shepherd-rules-*.json（项目规则）
     │
     ▼
3. 规则叠加生效（项目规则覆盖同名全局规则）
```

`/reload` 命令会重新加载所有规则，无需重启 pi。

## 配置

Shepherd 的配置通过 shared-utils 做三层合并（defaults → 全局 settings → 项目 settings）：

```json
// .pi/settings.json（项目级）
{
	"shepherd": {
		"projectRulesPattern": "shepherd-rules-",  // 项目规则文件前缀
		"maxWarnings": 5                            // 最大警告数
	}
}
```

## 下一步

了解 Shepherd 如何守卫 AI 行为后，下一节我们看 [Context Manager 如何控制信息质量](./context.md)。
