import { describe, it, expect } from 'vitest';
import { segmentMessages } from '../segmenter.js';
import type { AgentMessage } from '@earendil-works/pi-agent-core';

function makeUserMsg(text: string): AgentMessage {
	return { role: 'user', content: [{ type: 'text', text }], timestamp: Date.now() } as AgentMessage;
}

function makeAssistantMsg(text: string): AgentMessage {
	return { role: 'assistant', content: [{ type: 'text', text }], timestamp: Date.now() } as AgentMessage;
}

function makeToolResult(text: string): AgentMessage {
	return { role: 'toolResult', content: [{ type: 'text', text }], toolCallId: 'c1', timestamp: Date.now() } as AgentMessage;
}

describe('segmenter', () => {
	it('空消息返回空数组', () => {
		const result = segmentMessages([]);
		expect(result).toEqual([]);
	});

	it('少于一个段的消息合并为单段', () => {
		const msgs = [
			makeUserMsg('hello'),
			makeAssistantMsg('hi'),
		];
		const result = segmentMessages(msgs);
		expect(result).toHaveLength(1);
		expect(result[0].index).toBe(0);
		expect(result[0].messages.length).toBe(2);
	});

	it('按 turn 边界分段', () => {
		// 创建 20 个 turns (user + assistant + toolResult = 1 turn)
		const msgs: AgentMessage[] = [];
		for (let i = 0; i < 20; i++) {
			msgs.push(makeUserMsg(`user ${i}`));
			msgs.push(makeAssistantMsg(`assistant ${i}`));
			msgs.push(makeToolResult(`result ${i}`));
		}
		// 60 条消息，20 turns，按 15 turns 分 → 2 段
		const result = segmentMessages(msgs, { turnsPerSegment: 15 });
		expect(result.length).toBeGreaterThanOrEqual(2);
	});

	it('每段有 serialized 和 estimatedTokens', () => {
		const msgs = [
			makeUserMsg('test message'),
			makeAssistantMsg('response'),
		];
		const result = segmentMessages(msgs);
		expect(result[0].serialized.length).toBeGreaterThan(0);
		expect(result[0].estimatedTokens).toBeGreaterThan(0);
	});

	it('toolResult 不算 turn 边界', () => {
		// toolResult 紧跟 assistant，不应被当作新 turn 开始
		const msgs = [
			makeUserMsg('u1'),
			makeAssistantMsg('a1'),
			makeToolResult('r1'),
			makeToolResult('r2'), // 连续 toolResult
			makeUserMsg('u2'),
			makeAssistantMsg('a2'),
		];
		const result = segmentMessages(msgs);
		// 全部在一段内
		expect(result).toHaveLength(1);
	});
});
