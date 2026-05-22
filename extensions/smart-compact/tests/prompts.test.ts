import { describe, it, expect } from 'vitest';
import { parseSegmentSummary } from '../summarizer.js';
import { SEGMENT_USER_PROMPT, MERGE_SYSTEM_PROMPT } from '../prompts.js';

describe('prompts + summarizer', () => {
	describe('parseSegmentSummary', () => {
		it('解析有效 JSON 输出', () => {
			const input = `\`\`\`json
{"relevant": true, "topics": ["refactor", "API"], "summary": "重构了 API 接口"}
\`\`\``;
			const result = parseSegmentSummary(0, input);
			expect(result.relevant).toBe(true);
			expect(result.topics).toEqual(['refactor', 'API']);
			expect(result.summary).toContain('重构');
		});

		it('解析无 code fence 的 JSON', () => {
			const input = `{"relevant": false, "topics": ["探索"], "summary": "早期代码探索"}`;
			const result = parseSegmentSummary(2, input);
			expect(result.relevant).toBe(false);
			expect(result.index).toBe(2);
		});

		it('解析失败时标记为 relevant 并原文返回', () => {
			const input = 'This is not JSON at all';
			const result = parseSegmentSummary(1, input);
			expect(result.relevant).toBe(true); // 保守：失败时保留
			expect(result.summary).toContain('This is not JSON');
		});
	});

	describe('常量', () => {
		it('SEGMENT_USER_PROMPT 包含 current-task 占位符', () => {
			expect(SEGMENT_USER_PROMPT).toContain('{currentTask}');
		});

		it('MERGE_SYSTEM_PROMPT 非空', () => {
			expect(MERGE_SYSTEM_PROMPT.length).toBeGreaterThan(0);
		});
	});
});
