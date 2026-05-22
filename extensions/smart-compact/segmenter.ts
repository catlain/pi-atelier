/**
 * Phase 0: 按 turn 边界将消息分段。
 *
 * 每个 segment 包含原始消息和序列化后的文本，
 * 用于 Phase 1 的分段摘要。
 */
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SmartCompactConfig, Segment } from "./types.js";
import { DEFAULT_CONFIG } from "./config.js";
import { serializeConversationEnhanced } from "./serializer.js";

/** 判断消息是否是 turn 边界 */
function isTurnBoundary(msg: AgentMessage): boolean {
	return (
		msg.role === "user" ||
		msg.role === "bashExecution" ||
		msg.role === "compactionSummary" ||
		msg.role === "branchSummary"
	);
}

/** 每段最大 token 数（超过则递归二分） */
const MAX_SEGMENT_TOKENS = 30000;

/**
 * 按 turn 边界将消息分段。
 * 每 `turnsPerSegment` 个 turn 合为一段，超大段递归二分。
 */
export function segmentMessages(
	messages: AgentMessage[],
	config: Partial<SmartCompactConfig> = {},
): Segment[] {
	const fullConfig: SmartCompactConfig = { ...DEFAULT_CONFIG, ...config };
	const { turnsPerSegment } = fullConfig;

	if (messages.length === 0) return [];

	// 按 turn 分组
	const turns: AgentMessage[][] = [];
	let currentTurn: AgentMessage[] = [];

	for (const msg of messages) {
		if (isTurnBoundary(msg) && currentTurn.length > 0) {
			turns.push(currentTurn);
			currentTurn = [];
		}
		currentTurn.push(msg);
	}
	if (currentTurn.length > 0) {
		turns.push(currentTurn);
	}

	// 合并 turns 为 segments
	const segments: Segment[] = [];
	let segIndex = 0;

	for (let i = 0; i < turns.length; i += turnsPerSegment) {
		const chunk = turns.slice(i, i + turnsPerSegment);
		const segMessages = chunk.flat();
		const serialized = serializeConversationEnhanced(segMessages, fullConfig);
		const estimatedTokens = Math.ceil(serialized.length / 4);

		segments.push({
			index: segIndex++,
			messages: segMessages,
			serialized,
			estimatedTokens,
		});
	}

	// 对超大段递归二分
	const result: Segment[] = [];
	for (const seg of segments) {
		if (seg.estimatedTokens > MAX_SEGMENT_TOKENS && seg.messages.length > 1) {
			const mid = Math.floor(seg.messages.length / 2);
			const left = segmentMessages(seg.messages.slice(0, mid), fullConfig);
			const right = segmentMessages(seg.messages.slice(mid), fullConfig);
			result.push(...left, ...right);
		} else {
			result.push(seg);
		}
	}

	return result;
}
