/**
 * payload-analyzer 扩展入口
 *
 * 注册 1 个 pi 自定义工具：
 * - payload_analyze: 分析 provider payload 录制文件
 *   action: list/single/overview/chain/stats/diff/budget/expensive/growth
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
	doList,
	doSingle,
	doOverview,
	doChain,
	doChainTcId,
	doStats,
	doDiff,
} from "./analyze.js";
import { doBudget, doGrowth, doExpensive } from "./metrics.js";
import { DISTILL_DIR } from "./core.js";
import { getRecordingFiles } from "./files.js";
import { join } from "path";

const LAST_PAYLOAD = join(DISTILL_DIR, "last-payload.json");

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "payload_analyze",
		label: "Payload Analyzer",
		description:
			"分析 provider payload 录制文件。" +
			"\nlist: 列出录制文件" +
			"\nsingle: 分析单个 payload（tool result 状态分布）" +
			"\noverview: 详细分析 payload 结构（逐消息 token、distill 事件）" +
			"\nchain: 跨 payload 追踪同一 argsSig 的命运" +
			"\nchain-tcid: 跨 payload 追踪同一 toolCallId 的命运（验证 distill 行为）" +
			"\nstats: 聚合统计 distill/processor 命中率" +
			"\ndiff: 对比两个 payload 差异" +
			"\nbudget: Token 预算分析（每个请求的 system/tools/history 构成）" +
			"\nexpensive: 找出最贵的工具调用（按 token 排序）" +
			"\ngrowth: 上下文增长趋势（token 随请求变化的曲线）" +
			"\n需要先开启 record（/record on）产生录制文件。",
		promptSnippet: "分析 payload 录制文件：token 分布、增长趋势、昂贵调用",
		promptGuidelines: [
			"Use payload_analyze to inspect provider payload recordings for debugging token usage and distill behavior.",
			"Use action='budget' for token cost breakdown, action='growth' for context growth trend, action='expensive' to find biggest tool results.",
			"Use action='list' to see available recordings, action='overview' for detailed per-message analysis.",
		],
		parameters: Type.Object({
			action: Type.Union([
				Type.Literal("list"),
				Type.Literal("single"),
				Type.Literal("overview"),
				Type.Literal("chain"),
				Type.Literal("chain-tcid"),
				Type.Literal("stats"),
				Type.Literal("diff"),
				Type.Literal("budget"),
				Type.Literal("expensive"),
				Type.Literal("growth"),
			]),
			payloadPath: Type.Optional(
				Type.String({ description: "Payload 文件路径（single/overview/diff 用）" }),
			),
			payloadPath2: Type.Optional(
				Type.String({ description: "第二个 payload 路径（diff 用）" }),
			),
			verbose: Type.Optional(
				Type.Boolean({ description: "详细模式（overview 用），默认 false" }),
			),
			topN: Type.Optional(
				Type.Number({ description: "expensive 的 Top N，默认 20" }),
			),
			sessionId: Type.Optional(
				Type.String({ description: "会话 ID，用于按会话过滤录制文件" }),
			),
		}),

		async execute(
			_id: string,
			params: any,
			_signal: any,
			_onUpdate: any,
			_ctx: any,
		): Promise<any> {
			try {
				const sid = params.sessionId || undefined;
				switch (params.action) {
					case "list":
						return { content: [{ type: "text", text: doList(sid) }], details: {} };
					case "single":
						return { content: [{ type: "text", text: doSingle(params.payloadPath ?? LAST_PAYLOAD) }], details: {} };
					case "overview":
						return { content: [{ type: "text", text: doOverview(params.payloadPath ?? LAST_PAYLOAD, params.verbose ?? false) }], details: {} };
					case "chain":
						return { content: [{ type: "text", text: doChain(sid) }], details: {} };
					case "chain-tcid":
						return { content: [{ type: "text", text: doChainTcId(sid) }], details: {} };
					case "stats":
						return { content: [{ type: "text", text: doStats(sid) }], details: {} };
					case "diff": {
						if (!params.payloadPath || !params.payloadPath2) {
							return { content: [{ type: "text", text: "❌ diff 需要 payloadPath 和 payloadPath2 两个参数" }], details: {} };
						}
						return { content: [{ type: "text", text: doDiff(params.payloadPath, params.payloadPath2) }], details: {} };
					}
					case "budget":
						return { content: [{ type: "text", text: doBudget(sid) }], details: {} };
					case "expensive": {
						const files = getRecordingFiles(sid);
						if (!files) return { content: [{ type: "text", text: "没有录制文件" }], details: {} };
						return { content: [{ type: "text", text: doExpensive(files, params.topN ?? 20) }], details: {} };
					}
					case "growth":
						return { content: [{ type: "text", text: doGrowth(sid) }], details: {} };
					default:
						return { content: [{ type: "text", text: `未知 action: ${params.action}` }], details: {} };
				}
			} catch (err: unknown) {
				return {
					content: [{ type: "text", text: `❌ 错误: ${err instanceof Error ? err.message : String(err)}` }],
					details: {},
				};
			}
		},
	});
}
