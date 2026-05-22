/**
 * Phase 1: 分段摘要 + 相关性判断。
 *
 * 对每个 segment 并行调用 LLM，判断与当前任务的相关性并生成精简摘要。
 */
import type { Segment, SegmentSummary, SmartCompactConfig } from './types.js';
import { buildSegmentPrompt, SEGMENT_SUMMARY_SYSTEM } from './prompts.js';

// ─── JSON 提取 ───

function extractJSON(text: string): string {
	// 尝试提取 markdown code block 中的 JSON
	const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	if (codeBlockMatch) return codeBlockMatch[1].trim();

	// 尝试提取花括号包围的 JSON
	const braceMatch = text.match(/\{[\s\S]*\}/);
	if (braceMatch) return braceMatch[0];

	return text;
}

export function parseSegmentSummary(index: number, text: string): SegmentSummary {
	try {
		const json = extractJSON(text);
		const parsed = JSON.parse(json);
		return {
			index,
			relevant: parsed.relevant !== false,
			summary: typeof parsed.summary === 'string' ? parsed.summary : text,
			topics: Array.isArray(parsed.topics) ? parsed.topics : [],
		};
	} catch {
		// 解析失败，保守标记为相关
		return {
			index,
			relevant: true,
			summary: text.slice(0, 2000),
			topics: ['parse-error'],
		};
	}
}

// ─── 单段摘要 ───

export async function summarizeSegment(
	segment: Segment,
	currentTask: string,
	callLLM: (system: string, user: string, signal?: AbortSignal) => Promise<string>,
	signal?: AbortSignal,
): Promise<SegmentSummary> {
	const prompt = buildSegmentPrompt(segment.serialized, currentTask);
	const raw = await callLLM(SEGMENT_SUMMARY_SYSTEM, prompt, signal);
	return parseSegmentSummary(segment.index, raw);
}

// ─── 并行控制（滑动窗口） ───

async function parallelWithLimit<T>(
	tasks: Array<() => Promise<T>>,
	maxParallel: number,
): Promise<T[]> {
	const results: T[] = new Array(tasks.length);
	const executing = new Set<Promise<void>>();

	for (let i = 0; i < tasks.length; i++) {
		const idx = i;
		const task = tasks[idx];

		const p = task().then((result) => {
			results[idx] = result;
		}) as Promise<void>;

		executing.add(p);
		p.finally(() => executing.delete(p));

		if (executing.size >= maxParallel) {
			await Promise.race(executing);
		}
	}

	await Promise.all(executing);
	return results;
}

// ─── 主入口 ───

export async function summarizeSegments(
	segments: Segment[],
	currentTask: string,
	config: SmartCompactConfig,
	callLLM: (system: string, user: string, signal?: AbortSignal) => Promise<string>,
	signal?: AbortSignal,
): Promise<SegmentSummary[]> {
	if (segments.length === 0) return [];

	const tasks = segments.map((seg) => () =>
		summarizeSegment(seg, currentTask, callLLM, signal),
	);

	return parallelWithLimit(tasks, config.maxParallelSegments);
}
