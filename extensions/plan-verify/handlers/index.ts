/**
 * PV handlers — 使用 registerWorkflowTool 注册 6 个 action
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWorkflowTool } from "@pi-lainforge/workflow-core";
import { discoverAgents, getAgentDescription } from "@pi-lainforge/shared-utils";
import { Type } from "typebox";
import { stateManager, uiUpdater } from "../state";
import { getSubagentModel } from "@pi-lainforge/workflow-core";
import { doPlan } from "./plan";
import { doReview } from "./review";
import { doFix } from "./fix";
import { doExecute } from "./execute";
import { doWriteTests } from "./write-tests";
import { doRunTests } from "./run-tests";
import { doSimplify } from "./simplify";

import { doReviewTests } from "./review-tests";
import { handleExplore } from "./explore";

/** 构建 PV 工具的 description，包含可用子代理列表 */
function buildPvDescription(): string {
	const agents = discoverAgents();
	const agentsList = agents.length > 0
		? agents.map(a => `  - **${a}**: ${getAgentDescription(a)}`).join("\n")
		: "  (无可用子代理)";

	return [
		"Plan-Verify (PV) 是一整套开发工作流，遵循 SDD (Specification-Driven Development) + TDD (Test-Driven Development) 方法论。",
		"适用于中到大型代码变更：多文件修改、架构调整、新增功能模块等需要先方案再测试再实现的复杂任务。",
		"",
		"完整流程顺序：explore(方案探索) → plan(方案设计) → review-plan(方案审查) → fix-plan(方案修正重审) → " +
			"write-test(测试编写) → review-test(测试审查) → execute(执行实现) → run-test(运行测试) → simplify(代码简化) → run-test",
		"",
		"⚠ 注意：PV 是完整状态机工作流，不是独立工具合集。选择任意 action 即进入全流程，Gate 机制会引导按序完成。",
		"",
		"单次探索、分析或代码简化，请使用 subagent 工具代替。可用子代理：",
		agentsList,
	].join("\n");
}

export function registerPvTool(pi: ExtensionAPI): void {
	registerWorkflowTool(pi, {
		name: "pv",
description: buildPvDescription() + "" /* type coercion */ ,
	promptSnippet: "PV workflow (SDD+TDD): explore → plan → review-plan → fix-plan → write-test → review-test → execute → run-test → simplify → run-test",
		actions: {
			explore: {
				description: "启动代码探索子代理，分析架构、调用链路和设计模式",
				handler: handleExplore,
			},
			plan: {
				description: "标记方案设计阶段，确定方案文件路径",
				handler: doPlan,
			},
			"review-plan": {
				description: "启动方案审查子代理",
				handler: doReview,
			},
			"fix-plan": {
				description: "修正方案后重新审查",
				handler: doFix,
				gate: (state) => ({
					pass: state.round < state.maxRounds,
					reason: state.round >= state.maxRounds
						? `已达最大迭代轮次 (${state.maxRounds})`
						: undefined,
				}),
			},
			execute: {
				description: "进入执行阶段（需测试审查通过）",
				handler: doExecute,
				gate: (state) => {
					if (state.phase !== "test-review-decision") {
						return { pass: false, reason: "请先完成测试编写和审查流程（write-test → review-test）" };
					}
					const cs = state.issues.filter(i => i.severity === "critical").length;
					if (cs > 0) {
						return { pass: false, reason: `还有 ${cs} 个 critical 未解决，请先修正测试` };
					}
					return { pass: true };
				},
			},
			"write-test": {
				description: "进入测试编写阶段（需方案审查通过）",
				handler: doWriteTests,
				gate: (state) => {
					const cs = state.issues.filter((i) => i.severity === "critical").length;
					if (cs > 0) {
						return { pass: false, reason: `还有 ${cs} 个 critical 未解决，请先修正方案后再编写测试` };
					}
					return { pass: true };
				},
			},
			"review-test": {
				description: "审查测试代码（需先进入测试编写阶段）",
				handler: doReviewTests,
				gate: (state) => {
					if (state.phase !== "writing-tests" && state.phase !== "test-review-decision") {
						return { pass: false, reason: "请先执行 write-test 进入测试编写阶段" };
					}
					return { pass: true };
				},
			},
			"run-test": {
				description: "运行测试并报告结果",
				handler: doRunTests,
			},
			simplify: {
				description: "测试通过后，启动代码简化子代理：识别重复代码、低效写法、过度抽象，执行重构",
				handler: doSimplify,
			},
		},
		extraParams: {
			task: Type.Optional(Type.String({ description: "探索任务描述（explore action 必填）" })),
			model: Type.Optional(Type.String({ description: "子代理模型（可选，默认用配置值）" })),
			plan_content: Type.Optional(Type.String({ description: "方案内容（内联，无需文件路径时使用）" })),
		},
		stateManager: stateManager as any,
		uiUpdater: uiUpdater as any,
	});

	// tool_call 拦截器：注入默认模型
	pi.on("tool_call", (event, _ctx) => {
		if (event.toolName === "pv") {
			const input = event.input as Record<string, unknown>;
			if (!input.model || input.model === "") {
				input.model = getSubagentModel();
			}
		}
	});
}
