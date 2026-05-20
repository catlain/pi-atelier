/**
 * Plan-Verify Extension v7
 *
 * 使用 workflow 构建块的状态管理 + registerWorkflowTool。
 *
 * 模块结构：
 *   types.ts          — PV 专用类型（通用类型从 workflow 导入）
 *   state.ts          — 状态管理（createStateManager + createUIUpdater wrapper）
 *   handlers/         — 6 个 action handler（用 registerWorkflowTool 注册）
 *   prompts.ts        — 系统提示词
 *   orchestrator.ts   — 编排者指令
 *   tdd-utils.ts      — TDD 辅助函数
 *   utils.ts          — 辅助函数
 *   index.ts          — 主入口（事件 + 工具注册）
 */

import * as fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import type { PlanVerifyState, Phase } from "./types";
import { loadSubagentRules } from "./prompts";
import { ORCHESTRATOR_PLANNING_HEADER, buildReviewDecisionPrompt, buildTestReviewDecisionPrompt } from "./orchestrator";
import { registerPvTool } from "./handlers/index";
import { setSessionFileResolver } from "@pi-atelier/workflow-core";
import {
	getState,
	resetState,
	updateUI,
	persistState,
} from "./state";

export default function planVerifyExtension(pi: ExtensionAPI): void {
	loadSubagentRules();

	let state = getState();

	// ----------------------------------------------------------
	// 工具注册（单工具）
	// ----------------------------------------------------------

	registerPvTool(pi);

	// ----------------------------------------------------------
	// before_agent_start: 注入编排指令
	// ----------------------------------------------------------

	pi.on("before_agent_start", async () => {
		if (state.phase === "idle") return;

		const instructions: Record<Phase, string> = {
			idle: "",
			planning: ORCHESTRATOR_PLANNING_HEADER + (state.planFile ? `\n\n方案文件路径: ${state.planFile}` : ""),
			verifying: "",
			fixing: "",
			"review-decision": buildReviewDecisionPrompt(state),
			"writing-tests": `[PLAN-VERIFY ORCHESTRATOR]\n\n当前处于测试编写阶段。请根据方案中的测试策略，直接编写测试代码。写完后使用 pv 工具（action: "review_tests"）审查测试。`,
			"test-review-decision": buildTestReviewDecisionPrompt(state),
			"fixing-tests": `[PLAN-VERIFY ORCHESTRATOR]\n\n测试审查发现问题，请根据审查意见直接修正测试文件。修正完成后再次使用 pv 工具（action: "review_tests"）审查，直到 critical 和 warning 清零。`,
			executing: `[PLAN-VERIFY ORCHESTRATOR]\n\n当前处于执行阶段。请按方案逐步执行代码变更。执行完成后使用 pv 工具（action: "run_tests"）运行测试验证。如果测试失败，直接修复后再次 run_tests。`,
			simplifying: `[PLAN-VERIFY ORCHESTRATOR]\n\n代码简化已完成。请使用 pv 工具（action: "run_tests"）验证重构后测试仍然通过。如果测试失败，直接修复后再次 run_tests。`,
		};

		const instruction = instructions[state.phase];
		if (!instruction) return;

		return {
			message: {
				customType: "plan-verify-orchestrator",
				content: instruction,
				display: false,
			},
		};
	});

	// 清理旧编排提示
	pi.on("context", async (event) => {
		if (state.phase !== "idle") return;
		return {
			messages: event.messages.filter((m) => {
				const msg = m as any;
				return msg.customType !== "plan-verify-orchestrator";
			}),
		};
	});

	// ----------------------------------------------------------
	// 会话恢复
	// ----------------------------------------------------------

	pi.on("session_start", async (_event, ctx) => {
		loadSubagentRules();
		setSessionFileResolver(() => ctx.sessionManager?.getSessionFile());
		const entries = ctx.sessionManager.getEntries();

		const last = entries
			.filter((e: any) => e.type === "custom" && e.customType === "plan-verify")
			.pop() as { data?: PlanVerifyState } | undefined;

		if (last?.data) {
			Object.assign(state, last.data);

			const currentSessionId = ctx.sessionManager.getLeafId() || "";
			if (state.phase !== "idle" && state.sessionId && state.sessionId !== currentSessionId) {
				console.log("[pv] stale state detected: different session, resetting");
				state = resetState();
			}

			if (state.phase !== "idle" && state.planFile) {
				try {
					if (!fs.existsSync(state.planFile)) {
						console.log("[pv] stale state detected: planFile not found, resetting");
						state = resetState();
					}
				} catch {
					state = resetState();
				}
			}

			if (state.phase === "idle") persistState(ctx);
		} else {
			state = resetState();
		}

		state.sessionId = ctx.sessionManager.getLeafId() || ctx.sessionManager.getEntries()[0]?.id || "";

		updateUI(ctx);
	});
}