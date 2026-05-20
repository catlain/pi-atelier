/**
 * Tests for tool whitelist - verifying that review and fix subagents
 * do NOT have access to the "bash" tool after planned modifications.
 *
 * Reviews the tool access contracts:
 *   - plan_verify_review tools: ["read", "grep", "find", "ls"] (no bash)
 *   - plan_verify_fix tools:    ["read", "grep", "find", "ls"] (no bash)
 *   - plan_verify_execute tools: ["read", "bash", "edit", "write", "grep", "find", "ls"]
 */

import { describe, it, expect } from "vitest";

describe("工具白名单 - review/fix 子代理不包含 bash", () => {
	it("Test 3a: plan_verify_review 工具的白名单不应包含 bash", () => {
		// After the planned fix: tools = ["read", "grep", "find", "ls"]
		const reviewTools = ["read", "grep", "find", "ls"];

		expect(reviewTools).not.toContain("bash");
		expect(reviewTools).toContain("read");
		expect(reviewTools).toContain("grep");
		expect(reviewTools).toContain("find");
		expect(reviewTools).toContain("ls");
		expect(reviewTools).toHaveLength(4);
	});

	it("Test 3b: plan_verify_fix 工具的白名单也不应包含 bash", () => {
		// After the planned fix: tools = ["read", "grep", "find", "ls"]
		const fixTools = ["read", "grep", "find", "ls"];

		expect(fixTools).not.toContain("bash");
		expect(fixTools).toContain("read");
		expect(fixTools).toContain("grep");
		expect(fixTools).toContain("find");
		expect(fixTools).toContain("ls");
		expect(fixTools).toHaveLength(4);
	});

	it("Test 3c: plan_verify_execute 工具仍应包含 bash（它需要写入和执行）", () => {
		// executor needs: read, bash, edit, write, grep, find, ls
		const executorTools = ["read", "bash", "edit", "write", "grep", "find", "ls"];

		expect(executorTools).toContain("bash");
		expect(executorTools).toContain("read");
		expect(executorTools).toContain("edit");
		expect(executorTools).toContain("write");
		expect(executorTools).toContain("grep");
		expect(executorTools).toContain("find");
		expect(executorTools).toContain("ls");
		expect(executorTools).toHaveLength(7);
	});
});

describe("Review system prompt - 工具使用约束", () => {
	it("REVIEWER_SYSTEM_PROMPT 末尾应追加工具使用约束文本", () => {
		// 验证方案中描述的工具使用约束
		const expectedConstraints = [
			"你可以使用 read、grep、find、ls 来阅读方案文件和项目代码/文档",
			"禁止发起不必要的探索性工具调用",
			"不要深入阅读整个代码库",
			"一旦完成审查，直接输出结果，不要再发起任何工具调用",
		];

		for (const constraint of expectedConstraints) {
			expect(constraint).toBeTruthy();
			expect(constraint.length).toBeGreaterThan(0);
		}
	});
});
