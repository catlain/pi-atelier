import { describe, it, expect } from 'vitest';
import { mergeAndCompact } from '../merger.js';
import type { SegmentSummary } from '../summarizer.js';
import type { SmartCompactConfig } from '../types.js';
import type { AgentMessage } from '@earendil-works/pi-agent-core';

function makeConfig(): SmartCompactConfig {
	return {
		enabled: true,
		segmentModel: undefined,
		mergeModel: undefined,
		turnsPerSegment: 15,
		thinkingTruncateChars: 500,
		toolResultTruncateChars: 2000,
		maxParallelSegments: 3,
	};
}

// mock LLM caller
function mockLLM(response: string) {
	return async () => response;
}

describe('merger', () => {
	it('合并多个相关摘要', async () => {
		const summaries: SegmentSummary[] = [
			{ index: 0, relevant: true, summary: '摘要1: 做了A和B', topics: ['主题A'] },
			{ index: 1, relevant: true, summary: '摘要2: 做了C', topics: ['主题C'] },
		];

		const result = await mergeAndCompact(
			{
				relevantSummaries: summaries,
				currentTask: '完成功能X',
			},
			makeConfig(),
			mockLLM('## Goal\n完成功能X\n\n## Progress\n### Done\n- [x] 做了A和B\n- [x] 做了C') as any,
		);

		expect(result).toContain('## Goal');
		expect(result).toContain('功能X');
	});

	it('包含 previousSummary 时合并', async () => {
		const summaries: SegmentSummary[] = [
			{ index: 0, relevant: true, summary: '新工作', topics: ['新'] },
		];

		const result = await mergeAndCompact(
			{
				relevantSummaries: summaries,
				previousSummary: '## Goal\n旧目标\n\n## Progress\n### Done\n- [x] 旧任务',
				currentTask: '新任务',
			},
			makeConfig(),
			mockLLM('## Goal\n旧目标 + 新任务\n\n## Progress\n### Done\n- [x] 旧任务\n- [x] 新工作') as any,
		);

		expect(result).toContain('旧目标');
	});

	it('无相关摘要时返回任务描述', async () => {
		const result = await mergeAndCompact(
			{
				relevantSummaries: [],
				currentTask: '当前任务',
			},
			makeConfig(),
			mockLLM('## Goal\n当前任务\n\n## Progress\n(none)') as any,
		);

		expect(result).toContain('当前任务');
	});
});
