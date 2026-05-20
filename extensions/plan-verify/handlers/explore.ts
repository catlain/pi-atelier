/**
 * PV action: explore — 启动代码探索子代理
 *
 * 在 Planning 阶段内调用，让 pv-explorer 子代理深入分析代码架构和调用链路，
 * 产出 Context 节写入方案文件。state.phase 保持 "planning" 不变。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanVerifyState } from "../types";
import { runSubagent } from "@pi-lainforge/workflow-core";
import { createSubagentWidget } from "@pi-lainforge/workflow-core";
import { isSubagentSuccess, validatePlanFile, buildTask } from "../utils";
import { saveSubagentOutput } from "@pi-lainforge/workflow-core";

export async function handleExplore(
  params: any,
  state: PlanVerifyState,
  ctx: ExtensionContext,
  signal?: AbortSignal,
  onUpdate?: any,
): Promise<any> {
  const task = params.task;
  if (!task || typeof task !== "string" || task.trim().length === 0) {
    return {
      content: [{ type: "text", text: "探索需要 task 参数：描述要探索的技术任务。" }],
      details: { error: true },
    };
  }

  // 优先用 params.plan_file，回退到 state.planFile
  const planFile = params.plan_file || state.planFile;
  if (!planFile) {
    return {
      content: [{ type: "text", text: "方案文件路径未设置。请调用 pv(action: \"plan\") 且不传 plan_file 参数，将自动生成合法路径。" }],
      details: { error: true },
    };
  }
  // 校验路径必须在 .pi/plans/ 下
  const v = validatePlanFile(planFile, ctx.cwd, false);
  if (!v.valid) {
    return {
      content: [{ type: "text", text: `❌ ${v.reason}` }],
      details: { error: true },
    };
  }
  state.planFile = planFile;

  onUpdate?.({
    content: [{ type: "text", text: "🔍 正在启动 Explore 子代理（代码架构分析）..." }],
    details: {},
  });

  // 如果方案文件不存在，先创建空文件让子代理能写入
  const pf = state.planFile!;
  if (!fs.existsSync(pf)) {
    const dir = path.dirname(pf);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(pf, "", "utf-8");
  }

  const exploreTask = buildTask("explore-task.md", {
    planFile: state.planFile!,
    exploreTask: task,
  });

  const widget = createSubagentWidget(ctx, { title: "─ Explore ─" });
	const result = await runSubagent(
		"pv-explorer",
		exploreTask,
		ctx.cwd,
		signal,
		params.model,
		20 * 60 * 1000,
		widget.onEvent,
	);
  widget.cleanup();

  const saved = saveSubagentOutput(ctx.cwd, "explore", result.output, {});

  if (result.timedOut) {
    return {
      content: [{ type: "text", text: `⚠️ Explore 子代理超时\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
      details: { timedOut: true, outputFile: saved.filePath },
    };
  }

  if (!isSubagentSuccess(result)) {
    return {
      content: [{ type: "text", text: `Explore 子代理失败: ${result.stderr || result.error || "unknown error"}\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
      details: { error: true, outputFile: saved.filePath },
    };
  }

  // 探索完成，state.phase 保持 "planning"
  return {
    content: [{
      type: "text",
      text:
        `## Explore 子代理完成\n\n` +
        `探索结果已写入方案文件: \`${state.planFile}\`\n\n` +
        `${saved.summary}\n\n` +
        `完整输出: \`${saved.filePath}\`\n\n` +
        `请 read 方案文件查看 Context 节，然后基于探索结果撰写完整方案（补充目标、架构设计、实施步骤、测试策略）。`,
    }],
    details: { outputFile: saved.filePath },
  };
}
