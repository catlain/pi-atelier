/**
 * PV action: plan
 *
 * 统一生成 .pi/plans/plan-YYYYMMDD-HHMMSS.md 路径并创建占位文件。
 * 后续所有步骤只能读写这个路径，确保流程不丢失。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanVerifyState } from "../types";
import { generatePlanPath, validatePlanFile } from "../utils";

export async function doPlan(
	params: any,
	state: PlanVerifyState,
	ctx: ExtensionContext,
): Promise<any> {
	state.task = params.task;

	if (params.plan_file) {
		// 用户/AI 传入路径 → 校验必须在 .pi/plans/ 下，失败则自动回退
		const v = validatePlanFile(params.plan_file, ctx.cwd, false);
		state.planFile = v.valid ? params.plan_file : generatePlanPath(ctx.cwd);
	} else if (!state.planFile) {
		// 自动生成标准路径
		state.planFile = generatePlanPath(ctx.cwd);
	} else {
		// 已有 state.planFile → 校验仍然合法
		const v = validatePlanFile(state.planFile, ctx.cwd, false);
		if (!v.valid) {
			state.planFile = generatePlanPath(ctx.cwd);
		}
	}

	// 验证通过后才设 phase，避免 plan_file 非法时 state 不一致
	state.phase = "planning";

	// 创建占位文件（空文件），确保后续步骤能检测到路径存在
	const dir = path.dirname(state.planFile!);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	if (!fs.existsSync(state.planFile!)) {
		fs.writeFileSync(state.planFile!, "", "utf-8");
	}

	state.planContent = undefined;

	const msg = [
		"方案设计阶段已标记。",
		"",
		"**方案文件路径: " + state.planFile + "** （已自动创建，请将方案写入这个文件）",
		"",
		'请先调用 pv(action: "explore", task: "任务描述") 探索代码库，',
		"然后将完整技术方案写入上述路径。不要写入其他路径，否则后续步骤会报错。",
	].join("\n");

	return {
		content: [{ type: "text", text: msg }],
		details: { planFile: state.planFile },
	};
}
