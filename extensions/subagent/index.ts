/**
 * Subagent — 独立子代理工具
 *
 * 让 AI 可以直接启动任意已注册的子代理（agents/*.md）执行任务，
 * 不需要走 PV 工作流。
 *
 * 用法示例：
 *   subagent(name: "pv-explorer", task: "分析 XXX 的架构和调用链路")
 *   subagent(name: "pv-simplifier", task: "简化 src/utils.ts 中的重复代码")
 *   subagent(name: "pv-reviewer", task: "审查 .pi/plans/plan-xxx.md 方案")
 *
 * 可用子代理列表从 ~/.pi/agent/agents/*.md 自动发现。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runSubagent, isSubagentSuccess, createSubagentWidget, saveSubagentOutput, loadAgentDef, setSessionFileResolver } from "@pi-atelier/workflow-core";
import { registerModelManagement } from "./model-command";
import { discoverAgents, getAgentDescription } from "@pi-atelier/shared-utils";

// ============================================================
// 扩展入口
// ============================================================

export default function subagentExtension(pi: ExtensionAPI) {
	const agents = discoverAgents();

	// /subagent-model 命令 + tool_call 拦截器 + session_start 恢复
	registerModelManagement(pi);

	// subagent 工具注册
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
	description:
			"启动子代理执行独立任务（非 PV/FR/FO 全流程）。子代理在独立上下文窗口中运行，" +
			"有自己的工具集和 system prompt。" +
			"每次调用只执行一个任务，不会触发完整工作流。" +
			"适合单次的深度代码分析、代码审查、重复检测、方案审查、代码简化、信息搜索等需要独立视角的任务。" +
			"\n如果是复杂多步骤开发（方案→测试→实现），应使用 pv 工具走 SDD+TDD 全流程。" +
			"\n如果是系统性因子研究（多轮搜索+评估+综合），应使用 fr 工具走完整研究流程。" +
			"\n如果是系统性因子优化（初筛+解剖+组合+迭代+验证），应使用 fo 工具走完整优化流程。" +
			"\n\n可用子代理（自动从 ~/.pi/agent/agents/*.md 发现）:\n" +
			agents.map(a => `- **${a}**: ${getAgentDescription(a)}`).join("\n"),
		promptSnippet: "subagent(name, task) — 启动子代理执行任务，返回结果",
		parameters: Type.Object({
			name: Type.String({
				description: "子代理名称（对应 ~/.pi/agent/agents/{name}.md）",
			}),
			task: Type.String({
				description: "任务描述：告诉子代理要做什么",
			}),
			model: Type.Optional(Type.String({
				description: "可选模型覆盖（如 deepseek/deepseek-v4-flash）",
			})),
		}),

		async execute(
			_tcId: string,
			params: { name: string; task: string; model?: string },
			signal: AbortSignal | undefined,
			onUpdate: any,
			ctx: ExtensionContext,
		) {
			const { name, task, model } = params;
			setSessionFileResolver(() => ctx.sessionManager?.getSessionFile());

			// 校验 agent 存在
			const agentDef = loadAgentDef(name);
			if (!agentDef) {
				const available = agents.join(", ");
				return {
					content: [{ type: "text" as const, text: `❌ 子代理 "${name}" 未找到。\n\n可用子代理: ${available}` }],
					details: { error: true },
				};
			}

			onUpdate?.({
				content: [{ type: "text", text: `🚀 启动子代理 ${name}...` }],
				details: {},
			});

			const widget = createSubagentWidget(ctx, { title: `─ ${name} ─` });
			const result = await runSubagent(
				name,
				task,
				ctx.cwd,
				signal,
				model,
				10 * 60 * 1000,
				widget.onEvent,
			);
			widget.cleanup();

			const saved = saveSubagentOutput(ctx.cwd, `subagent-${name}`, result.output, {});

			if (result.timedOut) {
				return {
					content: [{
						type: "text" as const,
						text: `⚠️ 子代理 ${name} 超时\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\``,
					}],
					details: { timedOut: true, outputFile: saved.filePath },
				};
			}

			if (!isSubagentSuccess(result)) {
				return {
					content: [{
						type: "text" as const,
						text: `❌ 子代理 ${name} 失败: ${result.stderr || result.error || "unknown error"}\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\``,
					}],
					details: { error: true, outputFile: saved.filePath },
				};
			}

			return {
				content: [{
					type: "text" as const,
					text: `## 子代理 ${name} 完成\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\``,
				}],
				details: { outputFile: saved.filePath },
			};
		},
	} as any);
}
