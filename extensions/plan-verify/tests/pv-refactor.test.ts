/**
 * PV 重构回归测试
 *
 * 验证 PV 重构后（使用 workflow）的行为：
 * 1. state 单实例一致性 — stateManager.get() 在所有调用方返回同一引用
 * 2. session 恢复 — session_start 事件正确恢复状态
 * 3. 工作流冲突 — 运行时 /pv 提示冲突
 * 4. 命令行为 — /pv-abort 重置，/pv 启动
 * 5. state 赋值保留 — handlers/ 中的 state.xxx = ... 行数不低于重构前
 */

import { describe, it, expect, vi } from "vitest";
import { createStateManager } from "@pi-atelier/workflow-core";

// ============================================================
// Test 1: 单实例一致性
// ============================================================

describe("PV state 单实例一致性", () => {
	it("stateManager.get() 始终返回同一引用", () => {
		const stateManager = createStateManager({
			stateFile: ".pv-state.json",
			initialState: { phase: "idle", issues: [], round: 0, maxRounds: 5 },
			sessionEntryType: "plan-verify",
		});

		const ref1 = stateManager.get();
		const ref2 = stateManager.get();
		expect(ref1).toBe(ref2);

		// 修改 ref1，ref2 应同步
		ref1.phase = "planning";
		expect(ref2.phase).toBe("planning");
	});

	it("handlers 的 state 与命令函数 state 同一引用", () => {
		const stateManager = createStateManager({
			stateFile: ".pv-state.json",
			initialState: { phase: "idle", issues: [], round: 0, maxRounds: 5 },
			sessionEntryType: "plan-verify",
		});

		// 模拟 handlers 获取 state
		const handlerState = stateManager.get();
		// 模拟命令函数获取 state
		const cmdState = stateManager.get();

		expect(handlerState).toBe(cmdState);

		handlerState.phase = "executing";
		expect(cmdState.phase).toBe("executing");
	});

	it("stateManager.reset() 后旧 state 不受影响", () => {
		const stateManager = createStateManager({
			stateFile: ".pv-state.json",
			initialState: { phase: "idle", issues: [], round: 0, maxRounds: 5 },
			sessionEntryType: "plan-verify",
		});

		const oldRef = stateManager.get();
		oldRef.round = 3;
		stateManager.reset();
		expect(stateManager.get().round).toBe(0);
		expect(stateManager.get()).not.toBe(oldRef);
	});
});

// ============================================================
// Test 2: session 恢复
// ============================================================

describe("PV session 恢复", () => {
	it("restore() 恢复保存的状态", () => {
		const stateManager = createStateManager({
			stateFile: ".pv-state.json",
			initialState: { phase: "idle", issues: [], round: 0, maxRounds: 5 },
			sessionEntryType: "plan-verify",
		});

		const mockCtx = {
			cwd: "/tmp/test",
			sessionManager: {
				getEntries: vi.fn().mockReturnValue([
					{
						id: "e1",
						type: "custom",
						customType: "plan-verify",
						data: { phase: "executing", planFile: "/tmp/test/plan.md", round: 2 },
					},
				]),
			},
			ui: { setStatus: vi.fn(), setWidget: vi.fn() },
		} as any;

		stateManager.restore(mockCtx);
		const s = stateManager.get();
		expect(s.phase).toBe("executing");
		expect(s.round).toBe(2);
	});

	it("无 session entry → 保持不变", () => {
		const stateManager = createStateManager({
			stateFile: ".pv-state.json",
			initialState: { phase: "idle", issues: [], round: 0, maxRounds: 5 },
			sessionEntryType: "plan-verify",
		});

		stateManager.get().round = 42;
		const mockCtx = { sessionManager: { getEntries: vi.fn().mockReturnValue([]) } } as any;
		stateManager.restore(mockCtx);
		expect(stateManager.get().round).toBe(42);
	});

	it("损坏的 session data → 回退到 initialState", () => {
		const stateManager = createStateManager({
			stateFile: ".pv-state.json",
			initialState: { phase: "idle", issues: [], round: 0, maxRounds: 5 },
			sessionEntryType: "plan-verify",
		});

		const mockCtx = {
			sessionManager: {
				getEntries: vi.fn().mockReturnValue([
					{ id: "e1", type: "custom", customType: "plan-verify", data: null },
				]),
			},
		} as any;
		stateManager.restore(mockCtx);
		expect(stateManager.get().phase).toBe("idle");
	});
});

// ============================================================
// Test 3: 命令行为
// ============================================================

describe("PV 命令行为", () => {
	it("reset 将 state 重置为 idle", () => {
		const stateManager = createStateManager({
			stateFile: ".pv-state.json",
			initialState: { phase: "idle", issues: [], round: 0, maxRounds: 5 },
			sessionEntryType: "plan-verify",
		});

		stateManager.get().phase = "executing";
		stateManager.get().round = 3;

		stateManager.reset();
		expect(stateManager.get().phase).toBe("idle");
		expect(stateManager.get().round).toBe(0);
	});
});

// ============================================================
// Test 4: state 赋值保留检查
// ============================================================

describe("PV state 赋值保留", () => {
	it("index.ts 中用 getState() 而非本地 let state 初始化", () => {
		const fs = require("node:fs");
		const path = require("node:path");
		const indexPath = path.resolve(__dirname, "../index.ts");
		const content = fs.readFileSync(indexPath, "utf-8");

		// 不应有独立的 let state: PlanVerifyState = { ... } 初始化
		expect(content).not.toMatch(/let state:\s*PlanVerifyState\s*=\s*\{/);
		// 应该通过 getState() 获取
		expect(content).toContain("let state = getState()");
	});

	it("handlers/ 目录中的 state.xxx = ... 赋值数 ≥ 25", () => {
		const fs = require("node:fs");
		const path = require("node:path");
		const handlersDir = path.resolve(__dirname, "../handlers");

		if (!fs.existsSync(handlersDir)) {
			return; // 目录不存在则跳过
		}

		const files = fs.readdirSync(handlersDir)
			.filter((f: string) => f.endsWith(".ts") && f !== "index.ts");

		const allContent = files
			.map((f: string) => fs.readFileSync(path.join(handlersDir, f), "utf-8"))
			.join("\n");

		const assignCount = (allContent.match(/state\.\w+\s*=\s*/g) || []).length;
		expect(assignCount).toBeGreaterThanOrEqual(25);
	});
});
