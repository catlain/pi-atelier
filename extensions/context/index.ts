import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendFileSync } from "fs";
const PID = process.pid;
const DBG = (msg: string) => appendFileSync("/tmp/pi-context-debug.log", `[${PID}] ${msg}\n`);
import registerContextCommand from "./context.js";
import { setLastContextMessages, getContextConfig, manuallyDeletedIds, agingDeletedIds, agingTracker, agingSnapshot, setAgingSnapshot, setSessionId, saveManifest } from "./shared.js";
import {
	buildToolCallMap,
	estimateTokens,
	toolMeta,
	removeOrphanedToolCalls,
} from "./distill-helpers.js";
import { registerRecordCommand, registerDistillConfigCommand, registerProcessorConfigCommand, registerAgingConfigCommand } from "./commands.js";
import { registerToolResultProcessor } from "./tool-result-processor.js";
import { truncateToolCallArgs } from "./toolcall-args-truncator.js";

export default function (pi: ExtensionAPI) {
	registerContextCommand(pi);
	registerRecordCommand(pi);
	registerDistillConfigCommand(pi);
	registerProcessorConfigCommand(pi);
	registerAgingConfigCommand(pi);
	// 注册工具结果后处理器（格式化 + 大结果写文件）
	registerToolResultProcessor(pi);

	// ── 截断提示（按工具类型） ──
	function getDistillHint(toolName: string): string {
		return "此结果超过上下文阈值，下轮请求时会被自动移除。如需保留某些内容在上下文中，现在用 read + offset/limit 读取你需要的部分即可。";
	}

	// key: toolCallId
	// 首次超阈值：保留全文 + 截断提示
	// 已见（同 toolCallId）：静默删除 toolResult + 关联的 toolCall block
	const seenArgs = new Set<string>();

	// agingTracker 从 shared.ts 共享，供 collect.ts 读取展示

	// key: toolCallId, 已被截断的 toolCall ID（跨请求持久化）
	const truncatedToolCallIds = new Set<string>();

	pi.on("context", (event, _ctx) => {
		// setLastContextMessages 移到事件末尾（aging/distill 后），和 agingSnapshot 同步

		// 设置 sessionId 并加载对应的 manifest（会话级隔离）
		const sid = (_ctx as any)?.sessionManager?.getSessionId?.();
		if (sid) setSessionId(sid);

		const messages = event.messages as any[];
		const toolCallMap = buildToolCallMap(messages);
		const { distillThreshold, agingThreshold } = getContextConfig();

		// ── warmup：reload/tree 后恢复 distill/aging 状态 ──
		// seenArgs 和 agingTracker 是模块级变量，reload 或 tree 导航后会清空。
		// 检测条件：seenArgs 为空但 messages 中有大量 toolResult → 说明是恢复场景。
		// 预填所有 toolCallId，使首次 emitContext 就恢复蒸馏/遗忘行为。
		if (seenArgs.size === 0) {
			let toolResultCount = 0;
			for (const msg of messages) {
				if (msg.role === "toolResult") toolResultCount++;
			}
			if (toolResultCount > 10) {
				for (const msg of messages) {
					if (msg.role === "toolResult" && msg.toolCallId) {
						seenArgs.add(msg.toolCallId);
						// aging 不预填：reload 后从 0 开始自然计数，避免旧结果被立即删除
					}
				}
			}
		}

		// 收集待删除的 toolResult 索引（distill + aging 共享）
		const toRemove: number[] = [];
		// distill 标记删除的 tcId 集合，aging 用来跳过
		const distillRemovedIds = new Set<string>();

		// ── 第一遍：distill（大内容去重） ──
		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i];
			if (msg.role !== "toolResult") continue;

			const tcId = msg.toolCallId || "";
			if (!tcId) continue;

			const toolName = msg.toolName || "unknown";

			// ── 检查是否超过阈值 ──
			const textParts = (msg.content as any[]).filter((p: any) => p.type === "text");
			const origText = textParts.map((p: any) => p.text).join("");
			const origTokens = estimateTokens(origText);
			if (origTokens < distillThreshold) continue;

			// ── 精读提示（按工具类型） ──
			const distillHint = getDistillHint(toolName);

			// ── 已见（同 toolCallId）：静默删除旧内容，不膨胀 ──
			if (seenArgs.has(tcId)) {
				toRemove.push(i);
				distillRemovedIds.add(tcId);
				continue;
			}

			// ── 首次超阈值：保留全文 + 截断提示 ──
			seenArgs.add(tcId);

			const meta = toolMeta(msg, toolCallMap);
			const label = meta.meta || toolName;
			const short = `📋 [auto-distill] 「${label}」~${origTokens} tokens`;
			pi.events.emit("ephemeral:hint", { text: `${short}。${distillHint}`, short });
		}

		// ── 第二遍：aging（旧内容自动遗忘） ──
		const activeTcIds = new Set<string>();
		const agingRemovedTcIds = new Set<string>();
		DBG(`[ctx-event] BEFORE aging: trackerSize=${agingTracker.size} warmup=${seenArgs.size}`);

		if (agingThreshold > 0) {
			for (let i = 0; i < messages.length; i++) {
				const msg = messages[i];
				if (msg.role !== "toolResult") continue;

				const tcId = msg.toolCallId || "";
				if (!tcId) continue;

				// distill 优先：已被 distill 标记 → 跳过
				if (distillRemovedIds.has(tcId)) continue;

				// 已被 aging 永久删除 → 直接移除，不计数
				if (agingDeletedIds.has(tcId)) {
					toRemove.push(i);
					continue;
				}

				activeTcIds.add(tcId);

				const count = (agingTracker.get(tcId) || 0) + 1;
				agingTracker.set(tcId, count);

				if (count >= agingThreshold) {
					toRemove.push(i);
					agingRemovedTcIds.add(tcId);
				}
			}
		}

		DBG(`[ctx-event] AFTER aging: toRemove=${toRemove.length} agingThreshold=${agingThreshold}`);
		const agingSamples = [...agingTracker.entries()].slice(0, 3);
		for (const [k, v] of agingSamples) DBG(`  agingSample: ${k.slice(0, 8)}=${v}`);

		// 清理 tracker：移除已达到 aging 阈值的 tcId，加入永久删除集合并持久化
		if (agingRemovedTcIds.size > 0) {
			for (const tcId of agingRemovedTcIds) {
				agingTracker.delete(tcId);
				agingDeletedIds.add(tcId);
			}
			saveManifest();
		}

		// 清理 tracker 中不在当前 messages 里的 tcId（防止无限增长）
		for (const tcId of agingTracker.keys()) {
			if (!activeTcIds.has(tcId)) agingTracker.delete(tcId);
		}

		// 保存 aging 快照（cleanup 后，已删除的不在快照中）
		setAgingSnapshot(agingTracker);
		DBG(`[ctx-event] AFTER snapshot: snapSize=${agingSnapshot.size} trackerSize=${agingTracker.size}`);

		// ── 第三遍：手动删除（用户在 context 面板中标记删除的） ──
		const manualRemoveIds = new Set<string>();
		if (manuallyDeletedIds.size > 0) {
			for (let i = 0; i < messages.length; i++) {
				const msg = messages[i];
				if (msg.role !== "toolResult") continue;
				const tcId = msg.toolCallId || "";
				if (tcId && manuallyDeletedIds.has(tcId)) {
					toRemove.push(i);
					manualRemoveIds.add(tcId);
				}
			}
			// 清理已不存在于 messages 中的手动删除条目（防止集合无限增长）
			for (const id of manuallyDeletedIds) {
				if (!manualRemoveIds.has(id)) manuallyDeletedIds.delete(id);
			}
		}

		// 反向删除（避免索引偏移）+ 清理孤立 toolCall block
		DBG(`[ctx-event] toRemove=${toRemove.length} msgsBefore=${messages.length}`);
		if (toRemove.length > 0) {
			for (let i = toRemove.length - 1; i >= 0; i--) {
				messages.splice(toRemove[i], 1);
			}
			removeOrphanedToolCalls(messages);
		}
		DBG(`[ctx-event] msgsAfter=${messages.length}`);

		// ── 第三遍：截断 toolCall.arguments（大参数防膨胀） ──
		const processorThreshold = getContextConfig().processorThreshold;
		if (processorThreshold > 0) {
			truncateToolCallArgs(messages, processorThreshold, truncatedToolCallIds);
		}

		// ── 保存最终 messages（aging/distill/truncate 后），和 agingSnapshot 同步 ──
		setLastContextMessages(messages);
	});
}
