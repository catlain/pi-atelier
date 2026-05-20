/**
 * handler 调用链路集成测试 — Step 3
 *
 * 方案 Step 3: 所有 handler 迁移到 buildTask 后，调用链路不变。
 * mock 最外层边界 (runSubagent + 文件系统)，调真实 handler。
 *
 * 验证: handler 接口一致、runSubagent 被调用、返回结构含 content/details、
 *       state.phase 按预期流转、内联/文件模式均正常工作。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ============================================================
// Mock 最外层边界
// ============================================================

const mockRunSubagent = vi.fn();
vi.mock("@pi-atelier/workflow-core", () => ({
	runSubagent: mockRunSubagent,
	createSubagentWidget: vi.fn(() => ({ onEvent: vi.fn(), cleanup: vi.fn() })),
	saveSubagentOutput: vi.fn((_cwd, _name, _output, _meta) => ({
		summary: "Issues: 0 Critical, 0 Warning, 0 Suggestion",
		filePath: `/tmp/.pi/plans/${_name}.md`,
	})),
	isSubagentSuccess: vi.fn((r: any) => !r.error && !r.stderr),
	findSessionFile: vi.fn(),
	getSubagentStatusSummary: vi.fn(),
}));

import { doReview } from "../handlers/review";
import { doFix } from "../handlers/fix";

// ============================================================
// 测试基础设施
// ============================================================

let tmpDir: string;
let planFile: string;

function createMockProject() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pv-int-"));
	const plansDir = path.join(dir, ".pi", "plans");
	fs.mkdirSync(plansDir, { recursive: true });
	const pf = path.join(plansDir, "plan.md");
	fs.writeFileSync(pf, "# 方案\n\n## 实施步骤\n...", "utf-8");
	return { tmpDir: dir, planFile: pf };
}

beforeEach(() => {
	const m = createMockProject();
	tmpDir = m.tmpDir;
	planFile = m.planFile;
	mockRunSubagent.mockResolvedValue({
		exitCode: 0, output: "## Review\n\n**[Critical]** 测试不足", stderr: "", timedOut: false, subSessionId: "s1",
	});
});

function mockCtx() { return { cwd: tmpDir, ui: { setStatus: vi.fn(), setWidget: vi.fn() } }; }
function mockState(o: any = {}) {
	return { planFile, planContent: undefined, phase: "planning", issues: [], round: 0, maxRounds: 5, subSessionId: undefined, testFiles: [], ...o };
}

// ============================================================
// doReview 集成测试
// ============================================================

describe("doReview — 调用链路不变", () => {
	it("调用 runSubagent 并返回 content/details", async () => {
		const result = await doReview({}, mockState(), mockCtx());
		expect(result.content).toBeInstanceOf(Array);
		expect(result.content[0]).toHaveProperty("text");
		expect(mockRunSubagent).toHaveBeenCalledTimes(1);
	});

	it("传递 plan_file 到 state", async () => {
		const st = mockState({ planFile: undefined });
		await doReview({ plan_file: planFile }, st, mockCtx());
		expect(st.planFile).toBe(planFile);
	});

	it("task 包含方案文件路径", async () => {
		await doReview({}, mockState(), mockCtx());
		const task = mockRunSubagent.mock.calls[0][1];
		expect(task).toContain(planFile);
	});

	it("完成时 phase=review-decision", async () => {
		const st = mockState();
		await doReview({}, st, mockCtx());
		expect(st.phase).toBe("review-decision");
	});

	it("超时时 phase 仍为 review-decision", async () => {
		mockRunSubagent.mockResolvedValue({ exitCode: 1, output: "部分", stderr: "", timedOut: true, subSessionId: "t" });
		const st = mockState();
		const r = await doReview({}, st, mockCtx());
		expect(st.phase).toBe("review-decision");
		expect(r.content[0].text).toContain("超时");
	});

	it("子代理失败时 details.error=true", async () => {
		mockRunSubagent.mockResolvedValue({ exitCode: 1, output: "", stderr: "failed", error: "err", timedOut: false });
		const r = await doReview({}, mockState(), mockCtx());
		expect(r.details?.error).toBe(true);
	});

	it("内联模式 plan_content 同样工作", async () => {
		const st = mockState({ planFile: undefined, planContent: "# 内联" });
		await doReview({ plan_content: "# 内联方案内容" }, st, mockCtx());
		const task = mockRunSubagent.mock.calls[0][1];
		expect(task).toContain("内联方案内容");
	});
});

// ============================================================
// doFix 集成测试
// ============================================================

describe("doFix — 调用链路不变", () => {
	it("调用 runSubagent 并返回 content/details", async () => {
		const st = mockState({ round: 1, issues: [{ severity: "critical", category: "测试完备性", description: "缺测试" }] });
		const r = await doFix({}, st, mockCtx());
		expect(r.content).toBeInstanceOf(Array);
		expect(mockRunSubagent).toHaveBeenCalled();
	});

	it("递增 state.round", async () => {
		const st = mockState({ round: 1, issues: [] });
		await doFix({}, st, mockCtx());
		expect(st.round).toBe(2);
	});

	it("完成时 phase=review-decision", async () => {
		const st = mockState({ round: 1, issues: [] });
		await doFix({}, st, mockCtx());
		expect(st.phase).toBe("review-decision");
	});

	it("task 包含方案文件路径", async () => {
		await doFix({}, mockState({ round: 1 }), mockCtx());
		const task = mockRunSubagent.mock.calls[0][1];
		expect(task).toContain(planFile);
	});

	it("上一轮 issues 传入子代理 task", async () => {
		const issues = [
			{ severity: "critical" as const, category: "测试完备性" as const, description: "缺测试" },
			{ severity: "warning" as const, category: "完整性" as const, description: "边界未处理" },
		];
		const st = mockState({ round: 1, issues });
		await doFix({}, st, mockCtx());
		const task = mockRunSubagent.mock.calls[0][1];
		expect(task).toContain("CRITICAL");
		expect(task).toContain("缺测试");
		expect(task).toContain("WARNING");
	});

	it("无 issues 时不含上一轮问题内容", async () => {
		const st = mockState({ round: 1, issues: [] });
		await doFix({}, st, mockCtx());
		const task = mockRunSubagent.mock.calls[0][1];
		expect(task).not.toContain("上一轮审查问题");
	});
});
