import * as fs from "node:fs";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve, sep } from "node:path";
const execAsync = promisify(exec);

// 以下为 fallback 提示词，主配置在 ~/.pi/agent/agents/pv-*.md
// 当 agent .md 文件不存在时使用这些内置提示

export const TEST_WRITER_SYSTEM_PROMPT = `你是一个测试工程师子代理。你的唯一任务是根据实现方案编写测试代码。

**重要规则：**
- 只编写测试文件，不修改任何实现代码
- 为方案中的每个步骤编写对应的测试用例
- 覆盖：正常路径、错误路径、边界情况
- 根据项目自动选择合适的测试框架（jest/vitest/pytest/go test 等）
- 测试文件放在合适的目录（tests/、__tests__/spec/ 等，根据项目约定）
- 每个测试用例要有清晰的描述
- 确保测试可以被运行

**关于 Test Implementation 的职责：**
方案中的测试代码是 Test Specification（规格说明），定义了"测什么、期望什么行为"。
你的职责是将其转化为 Test Implementation（可执行的测试代码），包括：
- 定义所有 mock helper 函数（如 createMockExec、createMockContext 等）
- 定义所有 factory 函数（如 createMemorySearchHandler、buildSystemPrompt 等）
- 实现所有 fixture（如 makeJsonl、scanSessionFiles、runImport 等）
- 补全方案中只有注释没有实现的测试用例
- 添加必要的 import 语句和类型定义
- 确保测试代码可以直接运行

输出的每个测试文件使用以下格式：

### FILE: <文件路径>
\`\`\`<语言>
<测试代码>
\`\`\`

不要输出任何解释，只输出测试文件。`;

export async function writeTestFiles(
	output: string,
	cwd: string,
	onUpdate?: (update: any) => void,
): Promise<string[]> {
	const written: string[] = [];
	const fileRegex = /### FILE:\s*(.+?)\n```[\w]*\n([\s\S]*?)```/g;
	let match;

	while ((match = fileRegex.exec(output)) !== null) {
		const filePath = match[1].trim();
		const code = match[2];
		const fullPath = resolve(cwd, filePath);
		const safeCwd = resolve(cwd);
		if (!fullPath.startsWith(safeCwd + sep) && fullPath !== safeCwd) {
			console.warn(`[tdd] 路径遍历拒绝: ${filePath}`);
			continue;
		}

		await mkdir(dirname(fullPath), { recursive: true });
		await writeFile(fullPath, code, "utf-8");
		written.push(filePath);
		onUpdate?.({
			content: [{ type: "text", text: `  ✓ 已写入测试文件: ${filePath}` }],
		});
	}

	return written;
}

export async function detectTestCommand(cwd: string, override?: string): Promise<string> {
	if (override) {
		// 白名单校验：只允许已知的测试命令模式
		const ALLOWED = [
			"npm test", "pnpm test", "yarn test", "bun test",
			"npx vitest run", "npx jest",
			"uv run python -m pytest", "python3 -m pytest", "python -m pytest",
			"go test", "cargo test", "make test",
		];
		const base = override.trim();
		if (!ALLOWED.some(cmd => base === cmd || base.startsWith(cmd + " "))) {
			throw new Error(`不允许的测试命令: ${override}`);
		}
		return override;
	}
	const checks = [
		{ file: "package.json", cmd: "npm test" },
		{ file: "pyproject.toml", cmd: "uv run python -m pytest" },
		{ file: "setup.py", cmd: "python3 -m pytest" },
		{ file: "go.mod", cmd: "go test ./..." },
		{ file: "Cargo.toml", cmd: "cargo test" },
		{ file: "Makefile", cmd: "make test" },
	];
	for (const { file, cmd } of checks) {
		try {
			await readFile(join(cwd, file), "utf-8");
			return cmd;
		} catch { /* continue */ }
	}
	return "npm test";
}
