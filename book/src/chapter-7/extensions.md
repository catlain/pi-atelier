# 自己动手做扩展

## 为什么要自己写扩展？

pi-atelier 提供了 11 个扩展，覆盖了记忆、规划、规矩、复盘、压缩、自动化等核心场景。但每个项目都有自己的特殊需求：

- 你的团队用飞书而不是 Slack，需要一个飞书通知扩展
- 你做游戏开发，需要一个自动管理 assets 目录的扩展
- 你写学术论文，需要一个 LaTeX 编译 + 引用检查的扩展

> 💡 **扩展的本质就是给 AI 加新工具和新知识**。

## 扩展的架构

### 一个扩展由什么组成？

```
pi-xxx/
├── package.json        # 包元数据 + pi 扩展配置
├── index.ts            # 入口，注册工具和钩子
├── lib/                # 工具实现
│   └── tools-xxx.ts
├── prompts/            # 提示模板（AI 看到的描述）
│   └── xxx-description.md
└── README.md           # 文档
```

### 核心概念

| 概念 | 说明 | 类比 |
|------|------|------|
| **Tool** | AI 可以调用的函数 | 给 AI 一把新锤子 |
| **Hook** | 在特定时机执行的逻辑 | 给 AI 一个闹钟 |
| **Prompt** | 工具的描述（AI 看到的说明） | 告诉 AI 这把锤子怎么用 |
| **Config** | 用户可配置的参数 | 锤子的力度调节 |

### 扩展的生命周期

```
1. pi 启动
     │
     ▼
2. 加载 settings.json 中的 packages
     │
     ▼
3. 安装/更新扩展（npm 或 git）
     │
     ▼
4. 执行扩展的 activate() 函数
     │
     ├── 注册工具（registerTool）
     ├── 注册钩子（registerHook）
     └── 注入提示（injectPrompt）
     │
     ▼
5. AI 会话中可以调用新工具
```

## 实战：从零写一个"代码统计"扩展

让我们一步步写一个简单的扩展——统计项目代码行数。

### 第 1 步：创建项目

```bash
mkdir pi-code-stats
cd pi-code-stats
npm init -y
```

修改 `package.json`：

```json
{
  "name": "pi-code-stats",
  "version": "0.1.0",
  "main": "index.ts",
  "piExtension": true,
  "activationEvents": ["onTool:code_stats"]
}
```

### 第 2 步：写工具实现

`lib/tools-stats.ts`：

```typescript
import { execSync } from 'child_process';

export function countLines(directory: string, extension: string): {
  total: number;
  files: { path: string; lines: number }[];
} {
  const cmd = `find ${directory} -name "*.${extension}" -not -path "*/node_modules/*" -not -path "*/.git/*"`;
  const files = execSync(cmd).toString().trim().split('\n');
  
  const results = files.map(file => ({
    path: file,
    lines: Number(execSync(`wc -l < ${file}`).toString().trim())
  }));
  
  return {
    total: results.reduce((sum, r) => sum + r.lines, 0),
    files: results.sort((a, b) => b.lines - a.lines)
  };
}
```

### 第 3 步：写入口文件

`index.ts`：

```typescript
import { countLines } from './lib/tools-stats';

export function activate(context: ExtensionContext) {
  context.registerTool({
    name: 'code_stats',
    description: '统计项目代码行数',
    parameters: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: '要统计的目录路径'
        },
        extension: {
          type: 'string',
          description: '文件扩展名，如 ts, py, rs'
        }
      },
      required: ['directory']
    },
    handler: async (args) => {
      const result = countLines(args.directory, args.extension || 'ts');
      return {
        totalLines: result.total,
        fileCount: result.files.length,
        topFiles: result.files.slice(0, 10)
      };
    }
  });
}
```

### 第 4 步：写工具描述

`prompts/stats-description.md`：

```markdown
统计项目代码行数。

参数：
- directory（必填）：要统计的目录路径
- extension（可选）：文件扩展名，默认 ts

返回：
- totalLines：总行数
- fileCount：文件数
- topFiles：最大的 10 个文件

示例：
  code_stats(directory="src", extension="ts")
  → { totalLines: 12340, fileCount: 45, topFiles: [...] }
```

### 第 5 步：安装测试

```json
// settings.json
{
  "packages": [
    "./path/to/pi-code-stats"
  ]
}
```

重启 pi，AI 就能用 `code_stats` 工具了。

## pi-shared-utils：你的工具箱

写扩展时，不用什么都从零开始。`pi-shared-utils` 提供了一组常用工具函数：

| 模块 | 功能 | 什么时候用 |
|------|------|-----------|
| `logger` | 统一日志格式 | 需要打印调试信息 |
| `storage` | 跨会话持久存储 | 需要保存配置或状态 |
| `paths` | 统一路径处理 | 需要找文件位置 |
| `json` | 安全的 JSON 读写 | 需要操作 JSON 文件 |
| `validator` | 参数校验 | 需要验证工具参数 |
| `settings-backup` | settings.json 备份与回滚 | 需要安全写入配置 |
| `file-lock` | 文件锁（proper-lockfile 封装） | 需要防竞态写入 |
| `config` | 三层配置合并（defaults → 全局 → 项目） | 扩展需要可配置参数 |

### 使用示例

```typescript
import { logger, storage, paths } from 'pi-shared-utils';

// 日志
logger.info('扩展已激活');
logger.warn('配置文件缺失，使用默认值');

// 存储
const config = await storage.read('config.json');
await storage.write('config.json', { theme: 'dark' });

// 路径
const projectRoot = paths.getProjectRoot();
const memoryDir = paths.getMemoryDir();
```

### 配置 API 示例

如果你的扩展需要用户可配置的参数：

```typescript
import { getEffectiveConfig } from 'pi-shared-utils';

const defaults = { threshold: 1000, enabled: true };
const config = getEffectiveConfig('my-extension', defaults, cwd);
// config = 三层合并后的最终配置
```

## 调试你的扩展

扩展开发中最常遇到的问题：工具注册了但 AI 不调用、handler 报错了看不到日志、返回结果不是预期的。

### 查看日志输出

扩展中 `logger.info()` 和 `console.log()` 的输出会出现在 pi 的**终端窗口**中（不是聊天窗口）。调试步骤：

```bash
# 在终端中启动 pi（而不是后台运行），这样能看到所有日志输出
pi

# 然后在聊天窗口中让 AI 调用你的工具
# 终端会显示日志输出
```

### 确认工具是否注册成功

在 pi 聊天中直接问 AI：

```
你现在有哪些工具可以用？能看到 code_stats 吗？
```

如果 AI 看不到你的工具，检查：
- `package.json` 中是否有 `"piExtension": true`
- `settings.json` 中包路径是否正确
- `activate()` 函数是否正确导出

### 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| AI 看不到工具 | `piExtension` 字段缺失 | 在 package.json 加 `"piExtension": true` |
| 工具调用报错 | handler 内部异常 | 查看终端日志中的错误栈 |
| AI 不调用工具 | description 太模糊 | 让工具描述更具体，包含参数说明和示例 |
| 返回值为空 | 异步操作未 await | handler 加 `async`，调用加 `await` |
| 路径找不到 | 相对路径问题 | 用 `paths.getProjectRoot()` 获取绝对路径 |

> 💡 **技巧**：开发扩展时，可以在 handler 里先 `console.log(JSON.stringify(args, null, 2))` 打印参数，确认 AI 传了什么进来。

## 发布你的扩展

### 发布到 npm

```bash
# 1. 确认 package.json 信息完整
npm version patch  # 0.1.0 → 0.1.1

# 2. 发布
npm publish --access public
```

### 发布后的安装方式

其他用户在 `settings.json` 中添加你的包名即可：

```json
{
  "packages": [
    "pi-code-stats"
  ]
}
```

### 发布前的检查清单

- [ ] `package.json` 有完整的 `description` 和 `keywords`
- [ ] `README.md` 按模板写完（安装、使用、配置、示例）
- [ ] 有 `LICENSE` 文件
- [ ] 有 `CHANGELOG.md`
- [ ] 代码有基本的错误处理
- [ ] 工具描述（prompts/*.md）清晰完整

## 扩展开发的最佳实践

### ✅ 好的扩展设计

1. **单一职责**：一个扩展做一件事，不要把所有功能塞进一个包
2. **描述即文档**：工具的 description 写得足够清楚，AI 不需要猜
3. **参数校验**：在 handler 里验证参数，给出有意义的错误信息
4. **幂等操作**：同样的输入应该返回同样的结果，避免副作用

### ✅ 工具描述的写法

```markdown
# 好的描述
统计指定目录下特定类型文件的代码行数。
参数：
- directory（必填）：目录路径
- extension（可选）：文件后缀，默认 "ts"
返回：{ totalLines, fileCount, topFiles }
```

```markdown
# 不好的描述
统计代码
```

### ❌ 常见错误

- 工具名太泛：`analyze` → 应该是 `code_stats`
- 描述太简短：AI 不知道怎么用，会传错参数
- 忘记处理错误：文件不存在时直接崩溃
- 返回值太大：整个文件内容作为返回值 → 应该返回摘要

## 附录：pi 扩展 API 速查

### registerTool

```typescript
context.registerTool({
  name: string,           // 工具名（唯一标识）
  description: string,    // 工具描述（AI 看到的）
  parameters: JSONSchema, // 参数的 JSON Schema
  handler: (args) => any  // 执行函数
});
```

### registerHook

```typescript
// 注册事件钩子——在 AI 工作流的关键节点注入自定义逻辑
context.registerHook({
  event: string,    // 事件名：如 'tool_call', 'tool_result', 'agent_end', 'session_start', 'before_provider_request'
  handler: (payload) => HookResult  // HookResult 可以是 void、提示文本、或工具调用改写
});
```

### injectPrompt

```typescript
context.injectPrompt({
  target: 'system' | 'tool_description',
  content: string
});
```

> 📖 详细的 API 文档请参考 pi SDK 的类型定义和 [pi 扩展开发文档](https://github.com/catlain/pi-atelier)。

## 恭喜你读完了！

现在你已经了解了 pi-atelier 的全部核心概念：

1. **记忆**（pi-memory）— 让 AI 记住知识
2. **规划**（pi-roadmap）— 让 AI 管理任务
3. **规矩**（pi-shepherd + pi-context-manager）— 让 AI 遵守规则、控制信息质量
4. **复盘**（pi-session-analyzer）— 让 AI 记录和回溯工作
5. **压缩与诊断**（pi-smart-compact + pi-context-manager）— 让 AI 在长会话中保持聪明
6. **自动化**（pi-scheduler + pi-workflow）— 让 AI 主动工作
7. **扩展**（pi-shared-utils + 你自己的扩展）— 让 AI 无所不能

欢迎在 [GitHub](https://github.com/catlain/pi-atelier) 上提交 Issue 和 PR，一起让 AI 编程助手变得更好！
