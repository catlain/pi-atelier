/**
 * PV action: review
 */

import * as fs from "node:fs";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanVerifyState } from "../types";
import { resolvePlanSource, buildTask, extractIssues, NO_RETRO_LABEL_CONSTRAINT, ISSUES_JSON_CONSTRAINT, isSubagentSuccess, validatePlanFile } from "../utils";
import { runSubagent } from "@pi-lainforge/workflow-core";
import { createSubagentWidget } from "@pi-lainforge/workflow-core";
import { saveSubagentOutput } from "@pi-lainforge/workflow-core";


export async function doReview(
	params: any,
	state: PlanVerifyState,
	ctx: ExtensionContext,
	signal?: AbortSignal,
	onUpdate?: any,
): Promise<any> {
	const { planFile, planContentDirect } = resolvePlanSource(params, state);

	// 校验路径必须在 .pi/plans/ 下（内联内容不受此限制）
	if (!planContentDirect) {
		const v = validatePlanFile(planFile, ctx.cwd, true);
		if (!v.valid) {
			return {
				content: [{ type: "text", text: `❌ ${v.reason}` }],
				details: { error: true },
			};
		}
	}

	if (planFile && fs.existsSync(planFile)) {
		state.planFile = planFile;
	}

	state.planContent = undefined;
	state.phase = "verifying";
	if (params.plan_file) state.planFile = params.plan_file;

	onUpdate?.({
		content: [{ type: "text", text: "🔍 正在启动 Review 子代理(独立上下文窗口,干净的眼睛)..." }],
		details: {},
	});

	const task = buildTask("review-task.md",
		{ planFile: state.planFile! },
		{ planContentDirect },
	);

	const widget = createSubagentWidget(ctx, { title: "─ 方案审查 ─" });
	const result = await runSubagent("pv-reviewer", task, ctx.cwd, signal, params.model, 10 * 60 * 1000, widget.onEvent, [NO_RETRO_LABEL_CONSTRAINT, ISSUES_JSON_CONSTRAINT]);
	state.subSessionId = result.subSessionId;
	widget.cleanup();

	const { issues, parseError } = extractIssues(result.output);
	const criticals = issues.filter((i) => i.severity === "critical").length;
	const warnings = issues.filter((i) => i.severity === "warning").length;
	const suggestions = issues.filter((i) => i.severity === "suggestion").length;
	const saved = saveSubagentOutput(ctx.cwd, "plan-review", result.output, { criticals, warnings });

	if (parseError) {
		state.issues = issues;
		state.phase = "review-decision";
		return {
			content: [{ type: "text", text: `⚠️ Review 子代理输出格式异常：未找到结构化问题清单（<!-- ISSUES_JSON -->）。\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`\n\n请检查输出文件，手动确认问题数量后决定下一步。` }],
			details: { issues, parseError: true, criticals: 0, warnings: 0, suggestions: 0, round: state.round, outputFile: saved.filePath },
		};
	}

	if (result.timedOut) {
		state.issues = issues;
		state.phase = "review-decision";
		return {
			content: [{ type: "text", text: `⚠️ Review 子代理超时\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
			details: { issues, timedOut: true, outputFile: saved.filePath },
		};
	}

	if (!isSubagentSuccess(result)) {
		return {
			content: [{ type: "text", text: `Review 子代理失败: ${result.stderr || result.error || "unknown error"}\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
			details: { error: true, outputFile: saved.filePath },
		};
	}

	state.issues = issues;
	state.phase = "review-decision";

	return {
		content: [{ type: "text", text: `## Review 子代理完成\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
		details: { issues, criticals, warnings, suggestions, round: state.round, outputFile: saved.filePath },
	};
}
