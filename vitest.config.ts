import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// subagent 测试涉及 spawn 子进程，会弹出 pi 窗口
		// 只在明确指定文件时运行（如 npx vitest run path/to/x.subagent.test.ts）
		exclude: ["**/node_modules/**", "**/*.subagent.test.ts"],
	},
});
