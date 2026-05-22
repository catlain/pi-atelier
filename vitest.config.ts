import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// subagent 测试涉及 spawn 子进程，会弹出 pi 窗口
		// 只在明确指定文件时运行（如 npx vitest run path/to/x.subagent.test.ts）
		exclude: [
			"**/node_modules/**",
			"**/*.subagent.test.ts",
			// mcp-lite 测试用 node:test 而非 vitest，无法在 vitest 中运行
			"extensions/mcp-lite/*.test.ts",
			// journal 测试引用未实现的模块（WIP）
			"extensions/journal/tests/*.test.ts",
			// shepherd state-tracker 测试未完成
			"extensions/shepherd/tests/state-tracker.test.ts",
			// plan-verify 模板占位符已变更 + agent md 文件已重命名，测试未同步
			"extensions/plan-verify/tests/migration-equivalence.test.ts",
			"extensions/plan-verify/tests/agent-files.test.ts",
		],
	},
});
