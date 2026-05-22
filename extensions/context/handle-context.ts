/** handle-context.ts — context 事件处理逻辑（纯操作，从 index.ts 闭包获取状态引用） */
import { buildToolCallMap, estimateTokens, toolMeta, removeOrphanedToolCalls } from "./distill-helpers.js";
import { getContextConfig, distilledMap, readCachedMessages, writeCachedMessages, saveManifest, loadManifest } from "./shared.js";
import { truncateToolCallArgs } from "./toolcall-args-truncator.js";

export interface ContextState {
	agingTracker: Map<string, number>;
	agingSnapshot: Map<string, number>;
	manuallyDeletedIds: Set<string>;
	agingDeletedIds: Set<string>;
	seenArgs: Set<string>;
	truncatedToolCallIds: Set<string>;
	lastMessages: any[];
	sessionId: string;
}

export function handleContextEvent(
	event: { messages: any[] },
	_ctx: any,
	state: ContextState,
	pi: any,
) {
	const { agingTracker, agingSnapshot, manuallyDeletedIds, agingDeletedIds, seenArgs, truncatedToolCallIds } = state;

	// 设置 sessionId 并加载对应的 manifest
	const sid = _ctx?.sessionManager?.getSessionId?.();
	if (sid && sid !== state.sessionId) {
		const oldId = state.sessionId;
		state.sessionId = sid;
		if (oldId) {
			loadManifest(sid, { manuallyDeleted, agingDeleted });
		}
	}

	const messages = event.messages as any[];
	const toolCallMap = buildToolCallMap(messages);
	const { distillThreshold, agingThreshold } = getContextConfig();

	// ── warmup ──
	if (seenArgs.size === 0) {
		let toolResultCount = 0;
		for (const msg of messages) {
			if (msg.role === "toolResult") toolResultCount++;
		}
		if (toolResultCount > 10) {
			for (const msg of messages) {
				if (msg.role === "toolResult" && msg.toolCallId) {
					seenArgs.add(msg.toolCallId);
				}
			}
		}
	}

	const toRemove: number[] = [];
	const distillRemovedIds = new Set<string>();

	// ── 第一遍：distill ──
	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		if (msg.role !== "toolResult") continue;
		const tcId = msg.toolCallId || "";
		if (!tcId) continue;
		const toolName = msg.toolName || "unknown";

		const textParts = (msg.content as any[]).filter((p: any) => p.type === "text");
		const origText = textParts.map((p: any) => p.text).join("");
		const origTokens = estimateTokens(origText);
		if (origTokens < distillThreshold) continue;

		if (seenArgs.has(tcId)) {
			toRemove.push(i);
			distillRemovedIds.add(tcId);
			continue;
		}

		seenArgs.add(tcId);
		const meta = toolMeta(msg, toolCallMap);
		const label = meta.meta || toolName;
		const short = `📋 [auto-distill] 「${label}」~${origTokens} tokens`;
		pi.events.emit("ephemeral:hint", { text: `${short}。此结果超过上下文阈值，下轮请求时会被自动移除。`, short });
	}

	// ── 第二遍：aging ──
	const activeTcIds = new Set<string>();
	const agingRemovedTcIds = new Set<string>();

	if (agingThreshold > 0) {
		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i];
			if (msg.role !== "toolResult") continue;
			const tcId = msg.toolCallId || "";
			if (!tcId) continue;
			if (distillRemovedIds.has(tcId)) continue;

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

	// cleanup：移除达到阈值的 tcId，加入永久删除集合
	if (agingRemovedTcIds.size > 0) {
		for (const tcId of agingRemovedTcIds) {
			agingTracker.delete(tcId);
			agingDeletedIds.add(tcId);
		}
		saveManifest(state.sessionId, { manuallyDeleted, agingDeleted });
	}

	for (const tcId of agingTracker.keys()) {
		if (!activeTcIds.has(tcId)) agingTracker.delete(tcId);
	}

	// 更新 aging 快照
	agingSnapshot.clear();
	for (const [k, v] of agingTracker) agingSnapshot.set(k, v);

	// ── 第三遍：手动删除 ──
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
		for (const id of manuallyDeletedIds) {
			if (!manualRemoveIds.has(id)) manuallyDeletedIds.delete(id);
		}
	}

	// 反向删除 + 清理孤立 toolCall block
	if (toRemove.length > 0) {
		for (let i = toRemove.length - 1; i >= 0; i--) {
			messages.splice(toRemove[i], 1);
		}
		removeOrphanedToolCalls(messages);
	}

	// ── 截断 toolCall.arguments ──
	const { processorThreshold } = getContextConfig();
	if (processorThreshold > 0) {
		truncateToolCallArgs(messages, processorThreshold, truncatedToolCallIds);
	}

	// 保存最终 messages
	state.lastMessages = messages;
	writeCachedMessages(messages);
}
