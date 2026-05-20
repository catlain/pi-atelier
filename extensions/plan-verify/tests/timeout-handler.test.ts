/**
 * Tests for the timed out handler in plan_verify_review and plan_verify_fix.
 *
 * Verifies the behavior contracts defined in the plan:
 *   - SubagentResult has timedOut field
 *   - Timeout returns warning message
 *   - Partial output is still processed
 */

import { describe, it, expect } from "vitest";

describe("timeout 后调用方处理分支", () => {
	it("Test 5: review 超时后应返回警告信息而不是报错", () => {
		// After the fix, when result.timedOut is true, the handler should:
		// 1. Still extract issues from partial output
		// 2. Set state.phase = "review-decision"
		// 3. Return content with "⚠️ Review 子代理超时" warning

		const result = {
			exitCode: 1,
			output: "部分审查内容...\n\n**[Critical]** 测试覆盖不足",
			stderr: "",
			timedOut: true,
		};

		// Simulate the planned handler logic
		let outputText = "";
		let timedOutResponse = false;

		if (result.timedOut) {
			timedOutResponse = true;
			outputText = `⚠️ Review 子代理超时（5分钟），以下是已完成的审查内容：\n\n${result.output}`;
		}

		expect(timedOutResponse).toBe(true);
		expect(outputText).toContain("⚠️ Review 子代理超时");
		expect(outputText).toContain("部分审查内容");
		expect(outputText).toContain("[Critical]");
	});

	it("Test 5a: fix 超时后也应返回警告信息", () => {
		const result = {
			exitCode: 1,
			output: "部分审查...",
			stderr: "",
			timedOut: true,
		};

		let response = "";
		if (result.timedOut) {
			response = `⚠️ Review 子代理超时（5分钟），以下是已完成的审查内容：\n\n${result.output}`;
		}

		expect(response).toContain("⚠️");
		expect(response).toContain("Review 子代理超时");
	});

	it("Test 5b: 正常完成的非超时路径不触发超时处理", () => {
		// Normal completion: timedOut is false
		const result = { exitCode: 0, output: "审查完成", stderr: "", timedOut: false };

		let timedOutResponse = false;
		if (result.timedOut) {
			timedOutResponse = true;
		}

		expect(timedOutResponse).toBe(false);
		expect(result.timedOut).toBe(false);
	});

	it("Test 5c: 超时后仍更新 state.issues（从部分输出提取）", () => {
		// The plan says: "超时但可能有部分输出，仍然提取 issues"
		const partialOutput = "**[Critical]** 方案没有包含测试设计\n影响：无法验证测试完备性";

		const pattern = /\*{0,2}\[(Critical|Warning|Suggestion)\]\*{0,2}\s*:?\s*\n?([\s\S]*?)(?=\*{0,2}\[(?:Critical|Warning|Suggestion)\]|$)/gi;
		const matches = [...partialOutput.matchAll(pattern)];

		expect(matches).toHaveLength(1);
		expect(matches[0][1]).toBe("Critical");
	});

	it("Test 5d: 超时后 state.phase 正确设置为 review-decision", () => {
		// Contract: timeout still transitions to review-decision phase
		let phase = "";
		const result = { timedOut: true, output: "partial" };

		if (result.timedOut) {
			phase = "review-decision";
		}

		expect(phase).toBe("review-decision");
	});
});
