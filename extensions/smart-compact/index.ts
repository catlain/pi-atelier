/**
 * smart-compact — 增强版 compaction 扩展
 *
 * 通过 session_before_compact 事件接管 pi 内置 compaction，
 * 使用"分段精简 + 相关性筛选 + 合并压缩"三阶段策略，
 * 解决超长 session serialize 后超过 LLM 窗口的问题。
 */
import type { CompactionResult, SessionBeforeCompactEvent, ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { segmentMessages } from "./segmenter.js";
import { summarizeSegments, type SegmentSummary } from "./summarizer.js";
import { mergeAndCompact } from "./merger.js";
import { loadConfig, saveConfig } from "./config.js";
import { createLLMCaller, extractCurrentTask } from "./llm-caller.js";

export default async function (pi: ExtensionAPI) {
	// 手动触发标志：/smart-compact 命令强制走 smart-compact，无视 enabled 设置
	let forceRun = false;

	// 注册命令：触发增强版 compaction
	// 不直接调用 ctx.compact()，而是设标志后触发 compaction 事件
	// 这样 session_before_compact 处理器能感知到是手动触发
	// 但 fallback：如果 compact() 不可用就直接提示用户
	const doSmartCompact = async (_args: string, ctx: ExtensionCommandContext) => {
		forceRun = true;
		console.log("[smart-compact] 触发增强压缩...");
		try {
			ctx.compact();
		} catch {
			// ctx.compact() 可能不可用
			forceRun = false;
			console.error("[smart-compact] ctx.compact() 不可用，请使用 pi 内置 /compact");
		}
	};

	// 注册命令：触发增强版 compaction
	pi.registerCommand("smart-compact", {
		description: "分段精简 + 相关性筛选 + 合并压缩",
		handler: doSmartCompact,
	});

	// 注册命令：查看/修改配置
	pi.registerCommand("smart-compact-config", {
		description: "查看/修改 smart-compact 配置（auto=开启自动, manual=关闭自动）",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const arg = args.trim().toLowerCase();
			if (arg === "auto" || arg === "on" || arg === "true" || arg === "enable") {
				await saveConfig({ enabled: true });
				ctx.ui.notify("smart-compact 自动接管已开启", "info");
			} else if (arg === "manual" || arg === "off" || arg === "false" || arg === "disable") {
				await saveConfig({ enabled: false });
				ctx.ui.notify("smart-compact 自动接管已关闭（仅手动 /smart-compact 触发）", "info");
			} else {
				const config = await loadConfig();
				const status = config.enabled ? "✅ 自动接管已开启" : "❌ 自动接管已关闭（仅手动 /smart-compact 触发）";
				ctx.ui.notify(`${status}\n\n用法:\n  /smart-compact-config auto   — 开启自动\n  /smart-compact-config manual  — 关闭自动`, "info");
			}
		},
	});

	// 监听 compaction 事件，接管 pi 内置 compaction
	pi.on("session_before_compact", async (event: SessionBeforeCompactEvent, ctx: ExtensionCommandContext) => {
		const config = await loadConfig();

		if (!config.enabled && !forceRun) {
			console.log("[smart-compact] 已禁用，使用 pi 内置 compaction");
			return {};
		}
		forceRun = false; // 重置标志

		const { preparation, branchEntries, signal } = event;
		console.log(`[smart-compact] 接管: ${(preparation as any).messagesToSummarize?.length ?? "?"} 条消息待摘要`);

		try {
			// Phase 0: 分段
			const messagesToSummarize: any[] = (preparation as any).messagesToSummarize ?? [];
			const turnPrefixMessages: any[] = (preparation as any).turnPrefixMessages ?? [];
			const isSplitTurn: boolean = (preparation as any).isSplitTurn ?? false;
			const previousSummary: string | undefined = (preparation as any).previousSummary;
			const firstKeptEntryId: string = (preparation as any).firstKeptEntryId;
			const tokensBefore: number = (preparation as any).tokensBefore ?? 0;

			if (messagesToSummarize.length === 0) {
				console.log("[smart-compact] 没有需要摘要的消息，跳过");
				return {};
			}

			const segments = segmentMessages(messagesToSummarize, config);
			console.log(`[smart-compact] 分段完成: ${segments.length} 段`);

			// 创建 LLM 调用函数
			const callLLM = createLLMCaller(ctx, config.segmentModel);
			const segmentCallLLM = config.segmentModel
				? createLLMCaller(ctx, config.segmentModel)
				: callLLM;

			// Phase 0.5: 从尾部消息提取当前任务描述（供相关性判断使用）
			let currentTask = "";
			try {
				currentTask = await extractCurrentTask(messagesToSummarize, callLLM, config, signal);
				console.log(`[smart-compact] 当前任务: ${currentTask.slice(0, 100)}`);
			} catch {
				console.log("[smart-compact] 任务提取失败，使用空任务描述");
			}

			// Phase 1: 分段摘要 + 相关性判断
			const summaries = await summarizeSegments(
				segments,
				currentTask,
				config,
				segmentCallLLM,
				signal,
			);
			const relevantSummaries = summaries.filter((s: SegmentSummary) => s.relevant);
			console.log(`[smart-compact] 相关性筛选: ${relevantSummaries.length}/${summaries.length} 段相关`);

			// Phase 2: 合并压缩
			const summary = await mergeAndCompact(
				{
					relevantSummaries,
					turnPrefixMessages,
					previousSummary,
					currentTask,
				},
				config,
				callLLM,
				signal,
			);

			// 提取文件操作信息（从 preparation）
			const readFiles: string[] = (preparation as any).fileOps?.read
				? Array.from((preparation as any).fileOps.read)
				: [];
			const modifiedFiles: string[] = (preparation as any).fileOps?.edited
				? Array.from((preparation as any).fileOps.edited)
				: [];

			// 拼接文件操作信息到 summary
			let fullSummary = summary;
			if (readFiles.length > 0 || modifiedFiles.length > 0) {
				fullSummary += "\n\n## Files Tracked\n";
				if (readFiles.length > 0) fullSummary += `Read: ${readFiles.join(", ")}\n`;
				if (modifiedFiles.length > 0) fullSummary += `Modified: ${modifiedFiles.join(", ")}\n`;
			}

			console.log("[smart-compact] 完成");

			const result: CompactionResult = {
				summary: fullSummary,
				firstKeptEntryId,
				tokensBefore,
				details: { readFiles, modifiedFiles },
			};

			return { compaction: result };
		} catch (err) {
			console.error(`[smart-compact] 失败，回退 pi 内置: ${err}`);
			return {}; // 返回空 = 使用 pi 内置 compaction
		}
	});
}
