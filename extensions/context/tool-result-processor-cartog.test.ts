/**
 * tool-result-processor.ts 单元测试（Cartog 索引时间注入）
 *
 * 覆盖：cartog_search/outline/rag_search 结果末尾追加索引时间
 *
 * handler 在格式化 cartog 结果后追加一行：
 *   > cartog 索引时间: {时间}
 * 时间格式：YYYY-MM-DD HH:MM:SS
 */

import { describe, it, expect, vi } from "vitest";
import { registerToolResultProcessor } from "./tool-result-processor.js";

function createMockPi() {
	const handlers: Array<{
		event: string;
		handler: (event: any, ctx: any) => any;
	}> = [];

	const pi = {
		on: vi.fn((event: string, handler: (event: any, ctx: any) => any) => {
			handlers.push({ event, handler });
		}),
		events: { emit: vi.fn() },
	};

	function triggerToolResult(event: any): any {
		const trHandler = handlers.find(h => h.event === "tool_result");
		if (!trHandler) throw new Error("tool_result handler not registered");
		return trHandler.handler(event, {});
	}

	return { pi, triggerToolResult };
}

describe("Cartog 索引时间注入", () => {
	it("cartog_search 结果末尾追加索引时间信息", () => {
		const { pi, triggerToolResult } = createMockPi();
		registerToolResultProcessor(pi as any);

		const rawText = JSON.stringify([
			{ name: "hello", kind: "function", startLine: 1, endLine: 42 },
		]);

		const result = triggerToolResult({
			toolName: "cartog_search",
			content: [{ type: "text", text: rawText }],
			input: { query: "hello" },
			isError: false,
		});

		const text = result.content[0].text;
		expect(text).toContain("hello");
		expect(text).toMatch(/> cartog 索引时间:/);
	});

	it("cartog_outline 结果末尾追加索引时间信息", () => {
		const { pi, triggerToolResult } = createMockPi();
		registerToolResultProcessor(pi as any);

		const rawText = JSON.stringify([
			{ name: "main", kind: "class", startLine: 1, endLine: 200 },
		]);

		const result = triggerToolResult({
			toolName: "cartog_outline",
			content: [{ type: "text", text: rawText }],
			input: { path: "file.ts" },
			isError: false,
		});

		const text = result.content[0].text;
		expect(text).toContain("main");
		expect(text).toMatch(/> cartog 索引时间:/);
	});

	it("cartog_rag_search 结果末尾追加索引时间信息", () => {
		const { pi, triggerToolResult } = createMockPi();
		registerToolResultProcessor(pi as any);

		const rawText = JSON.stringify([
			{ name: "searchResult", kind: "function", startLine: 10, endLine: 30 },
		]);

		const result = triggerToolResult({
			toolName: "cartog_rag_search",
			content: [{ type: "text", text: rawText }],
			input: { query: "search" },
			isError: false,
		});

		const text = result.content[0].text;
		expect(text).toContain("searchResult");
		expect(text).toMatch(/> cartog 索引时间:/);
	});

	it("索引时间格式符合预期：> cartog 索引时间: YYYY-MM-DD HH:MM:SS", () => {
		const { pi, triggerToolResult } = createMockPi();
		registerToolResultProcessor(pi as any);

		const rawText = JSON.stringify([
			{ name: "f", kind: "func", startLine: 1, endLine: 10 },
		]);

		const result = triggerToolResult({
			toolName: "cartog_search",
			content: [{ type: "text", text: rawText }],
			input: { query: "f" },
			isError: false,
		});

		const text = result.content[0].text;
		expect(text).toMatch(/> cartog 索引时间: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
	});

	it("大结果路径下 cartog 索引时间仍在摘要中保留", () => {
		const { pi, triggerToolResult } = createMockPi();
		registerToolResultProcessor(pi as any, { distillThreshold: 100 });

		// 生成足够大的 JSON 数据以触发大结果路径（需要 >= 100 tokens = 400 chars）
		const items = Array.from({ length: 50 }, (_, i) => ({
			name: `func_${i}_${"x".repeat(20)}`, kind: "function", startLine: i * 10, endLine: i * 10 + 9,
		}));
		const rawText = JSON.stringify(items);

		const result = triggerToolResult({
			toolName: "cartog_search",
			content: [{ type: "text", text: rawText }],
			input: { query: "bigItem" },
			isError: false,
		});

		const text = result.content[0].text;
		expect(text).toContain("[processed]");
		expect(text).toMatch(/> cartog 索引时间:/);
	});

	it("非 cartog 工具不注入索引时间", () => {
		const { pi, triggerToolResult } = createMockPi();
		registerToolResultProcessor(pi as any);

		const rawText = JSON.stringify({ title: "普通网页", url: "https://x.com", content: "正文" });

		const result = triggerToolResult({
			toolName: "web_read",
			content: [{ type: "text", text: rawText }],
			input: { url: "https://x.com" },
			isError: false,
		});

		const text = result.content[0].text;
		expect(text).not.toMatch(/> cartog 索引时间:/);
	});
});
