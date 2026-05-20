/**
 * PV action: review_tests - 审查测试代码是否符合方案要求
 */

import * as fs from "node:fs";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanVerifyState } from "../types";
import { extractIssues, NO_RETRO_LABEL_CONSTRAINT, ISSUES_JSON_CONSTRAINT, isSubagentSuccess, validatePlanFile, buildTask } from "../utils";
import { runSubagent } from "@pi-lainforge/workflow-core";
import { createSubagentWidget } from "@pi-lainforge/workflow-core";
import { saveSubagentOutput } from "@pi-lainforge/workflow-core";


export async function doReviewTests(
	params: any,
	state: PlanVerifyState,
	ctx: ExtensionContext,
	signal?: AbortSignal,
	onUpdate?: any,
): Promise<any> {
	const planFile = params.plan_file || state.planFile;

	const v = validatePlanFile(planFile, ctx.cwd, true);
	if (!v.valid) {
		return {
			content: [{ type: "text", text: `❌ ${v.reason}` }],
			details: { error: true },
		};
	}

	state.phase = "verifying";
	state.issues = [];
	state.round++;

	onUpdate?.({
		content: [{ type: "text", text: "🔍 正在启动测试审查子代理..." }],
		details: {},
	});

	// 构建测试文件列表
	const testFilesList = state.testFiles && state.testFiles.length > 0
		? state.testFiles.map((f, i) => `${i + 1}. \`${f}\``).join("\n")
		: "(未记录,请从方案中推断测试文件路径并 read)";

	const task = buildTask("review-tests-task.md", {
		planFile,
		testFilesList,
	});

	const widget = createSubagentWidget(ctx, { title: `─ 测试审查 R${state.round} ─` });

	const result = await runSubagent("pv-test-reviewer", task, ctx.cwd, signal, params.model, 10 * 60 * 1000, widget.onEvent, [NO_RETRO_LABEL_CONSTRAINT, ISSUES_JSON_CONSTRAINT]);
	state.subSessionId = result.subSessionId;
	widget.cleanup();

	const { issues, parseError } = extractIssues(result.output);
	const criticals = issues.filter((i) => i.severity === "critical").length;
	const warnings = issues.filter((i) => i.severity === "warning").length;
	const saved = saveSubagentOutput(ctx.cwd, `test-review-r${state.round}`, result.output, { criticals, warnings });

	if (parseError) {
		state.issues = issues;
		state.phase = "test-review-decision";
		return {
			content: [{ type: "text", text: `⚠️ 测试审查子代理输出格式异常：未找到结构化问题清单（<!-- ISSUES_JSON -->）。\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`\n\n请检查输出文件，手动确认问题数量后决定下一步。` }],
			details: { issues, parseError: true, criticals: 0, warnings: 0, round: state.round, outputFile: saved.filePath },
		};
	}

	if (result.timedOut) {
		state.issues = issues;
		state.phase = "test-review-decision";
		return {
			content: [{ type: "text", text: `⚠️ 测试审查子代理超时\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
			details: { issues, timedOut: true, outputFile: saved.filePath },
		};
	}

	if (!isSubagentSuccess(result)) {
		return {
			content: [{ type: "text", text: `测试审查子代理失败: ${result.stderr || result.error || "unknown error"}\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
			details: { error: true, outputFile: saved.filePath },
		};
	}

	state.issues = issues;
	state.phase = "test-review-decision";

	return {
		content: [{ type: "text", text: `## 测试审查完成 (轮次 ${state.round})\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
		details: { issues, criticals, warnings, round: state.round, outputFile: saved.filePath },
	};
}
