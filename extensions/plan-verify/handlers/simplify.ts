/**
 * PV action: simplify — 测试通过后对实现代码做简化分析 + 重构
 *
 * 子代理 pv-simplifier 分析代码质量，识别重复/低效/过度抽象，
 * 执行重构后返回报告。主代理再跑一次测试验证。
 */

import * as fs from "node:fs";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanVerifyState } from "../types";
import { runSubagent } from "@pi-atelier/workflow-core";
import { createSubagentWidget } from "@pi-atelier/workflow-core";
import { isSubagentSuccess, validatePlanFile, buildTask } from "../utils";
import { saveSubagentOutput } from "@pi-atelier/workflow-core";

export async function doSimplify(
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

	onUpdate?.({
		content: [{ type: "text", text: "🔍 正在启动代码简化分析子代理..." }],
		details: {},
	});

	const task = buildTask("simplify-task.md", { planFile });

	const widget = createSubagentWidget(ctx, { title: "─ 代码简化 ─" });

	const result = await runSubagent("pv-simplifier", task, ctx.cwd, signal, params.model, 10 * 60 * 1000, widget.onEvent);
	widget.cleanup();

	const saved = saveSubagentOutput(ctx.cwd, "simplify", result.output, {});

	if (result.timedOut) {
		return {
			content: [{ type: "text", text: `⚠️ 代码简化子代理超时\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
			details: { timedOut: true, outputFile: saved.filePath },
		};
	}

	if (!isSubagentSuccess(result)) {
		return {
			content: [{ type: "text", text: `代码简化子代理失败: ${result.stderr || result.error || "unknown error"}\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
			details: { error: true, outputFile: saved.filePath },
		};
	}

	return {
		content: [{
			type: "text",
			text:
				`## 代码简化完成\n\n` +
				`${saved.summary}\n\n` +
				`完整输出: \`${saved.filePath}\`\n\n` +
				`请运行 \`pv(action: "run-test")\` 验证重构后测试仍然通过。`,
		}],
		details: { outputFile: saved.filePath },
	};
}
