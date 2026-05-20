/**
 * PV action: fix
 */

import * as fs from "node:fs";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanVerifyState } from "../types";
import { buildTask, extractIssues, NO_RETRO_LABEL_CONSTRAINT, ISSUES_JSON_CONSTRAINT, isSubagentSuccess, validatePlanFile } from "../utils";
import { runSubagent } from "@pi-lainforge/workflow-core";
import { createSubagentWidget } from "@pi-lainforge/workflow-core";
import { saveSubagentOutput } from "@pi-lainforge/workflow-core";


export async function doFix(
	params: any,
	state: PlanVerifyState,
	ctx: ExtensionContext,
	signal?: AbortSignal,
	onUpdate?: any,
): Promise<any> {
	if (params.plan_file) state.planFile = params.plan_file;

	const v = validatePlanFile(state.planFile, ctx.cwd, true);
	if (!v.valid) {
		return {
			content: [{ type: "text", text: `❌ ${v.reason}` }],
			details: { error: true },
		};
	}

	state.round++;
	state.planContent = undefined;
	const previousIssues = [...state.issues];
	state.issues = [];
	state.phase = "verifying";

	onUpdate?.({
		content: [{ type: "text", text: `🔍 正在启动 Review 子代理 (轮次 ${state.round}/${state.maxRounds})...` }],
		details: {},
	});

	const prevIssuesSummary = state.round > 1 && previousIssues.length > 0
		? "\n\n## 上一轮审查问题\n\n" + previousIssues.map((iss, idx) =>
			`${idx + 1}. ${iss.severity.toUpperCase()}: ${iss.description}${iss.suggestion ? ` → 建议: ${iss.suggestion}` : ""}`
		).join("\n") + "\n\n请检查上述问题是否已在方案中修正。\n**只输出仍未修正的问题**（用 [Critical]/[Warning] 格式），不要重复列出已修正的问题。同时检查是否有新引入的问题。"
		: "";

	const task = buildTask("fix-task.md", {
		planFile: state.planFile!,
		previousIssues: prevIssuesSummary,
	});

	const widget = createSubagentWidget(ctx, { title: `─ 方案审查 R${state.round} ─` });
	const result = await runSubagent("pv-reviewer", task, ctx.cwd, signal, params.model, 10 * 60 * 1000, widget.onEvent, [NO_RETRO_LABEL_CONSTRAINT, ISSUES_JSON_CONSTRAINT]);
	state.subSessionId = result.subSessionId;
	widget.cleanup();

	const { issues: newIssues, parseError } = extractIssues(result.output);
	const c = newIssues.filter((i) => i.severity === "critical").length;
	const w = newIssues.filter((i) => i.severity === "warning").length;
	const saved = saveSubagentOutput(ctx.cwd, `plan-fix-r${state.round}`, result.output, { criticals: c, warnings: w });

	if (parseError) {
		state.issues = newIssues;
		state.phase = "review-decision";
		return {
			content: [{ type: "text", text: `⚠️ Review 子代理输出格式异常：未找到结构化问题清单（<!-- ISSUES_JSON -->）。\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`\n\n请检查输出文件，手动确认问题数量后决定下一步。` }],
			details: { issues: newIssues, parseError: true, round: state.round, outputFile: saved.filePath },
		};
	}

	if (result.timedOut) {
		state.issues = newIssues;
		state.phase = "review-decision";
		return {
			content: [{ type: "text", text: `⚠️ Review 子代理超时\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
			details: { issues: newIssues, timedOut: true, round: state.round, outputFile: saved.filePath },
		};
	}

	if (!isSubagentSuccess(result)) {
		return {
			content: [{ type: "text", text: `Review 子代理失败: ${result.stderr || result.error}\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
			details: { error: true, outputFile: saved.filePath },
		};
	}

	state.issues = newIssues;
	state.phase = "review-decision";

	return {
		content: [{ type: "text", text: `## Review 完成 (轮次 ${state.round})\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
		details: { issues: newIssues, criticals: c, warnings: w, round: state.round, outputFile: saved.filePath },
	};
}
