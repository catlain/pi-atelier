/**
 * Phase 2: 合并压缩。
 *
 * 将相关段的摘要合并为最终的 compaction summary。
 */
import type { SegmentSummary, SmartCompactConfig } from "./types.js";
import { buildMergePrompt, MERGE_SUMMARY_SYSTEM } from "./prompts.js";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { serializeConversationEnhanced } from "./serializer.js";

export interface MergeInput {
	relevantSummaries: SegmentSummary[];
	turnPrefixMessages?: AgentMessage[];
	previousSummary?: string;
	currentTask: string;
}

/**
 * 合并相关段摘要为最终 compaction summary。
 */
export async function mergeAndCompact(
	input: MergeInput,
	config: SmartCompactConfig,
	callLLM: (system: string, user: string, signal?: AbortSignal) => Promise<string>,
	signal?: AbortSignal,
): Promise<string> {
	const { relevantSummaries, turnPrefixMessages, previousSummary, currentTask } = input;

	// 如果没有相关段，返回任务描述作为 summary
	if (relevantSummaries.length === 0) {
		return `## Goal\n${currentTask}\n\n## Progress\n### Done\n(none)\n\n## Next Steps\n(continue current task)`;
	}

	// 序列化 turn prefix（如有）
	let turnPrefix: string | undefined;
	if (turnPrefixMessages && turnPrefixMessages.length > 0) {
		turnPrefix = serializeConversationEnhanced(turnPrefixMessages, {
			thinkingTruncateChars: config.thinkingTruncateChars,
			toolCallTruncateChars: config.toolCallTruncateChars,
		});
	}

	const prompt = buildMergePrompt(
		relevantSummaries.map((s) => ({ topics: s.topics, summary: s.summary })),
		previousSummary,
		turnPrefix,
	);

	return callLLM(MERGE_SUMMARY_SYSTEM, prompt, signal);
}
