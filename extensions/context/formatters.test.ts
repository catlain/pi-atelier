/**
 * formatters.ts 单元测试（基础格式化 + cartog）
 *
 * 覆盖：unwrapDoubleEncodedJson, truncateAtParagraph, formatCartogResult, formatBashResult
 */

import { describe, it, expect } from "vitest";
import {
	unwrapDoubleEncodedJson,
	truncateAtParagraph,
	formatCartogResult,
	formatBashResult,
} from "./formatters.js";

// ── unwrapDoubleEncodedJson ────────────────────────

describe("unwrapDoubleEncodedJson", () => {
	it("解包双重编码的 JSON 对象", () => {
		const raw = JSON.stringify(JSON.stringify({ title: "test" }));
		expect(unwrapDoubleEncodedJson(raw)).toBe(JSON.stringify({ title: "test" }));
	});

	it("解包双重编码的 JSON 数组", () => {
		const raw = JSON.stringify(JSON.stringify([{ title: "a" }]));
		expect(unwrapDoubleEncodedJson(raw)).toBe(JSON.stringify([{ title: "a" }]));
	});

	it("非双重编码时原样返回", () => {
		const raw = JSON.stringify({ title: "test" });
		expect(unwrapDoubleEncodedJson(raw)).toBe(raw);
	});

	it("非 JSON 文本原样返回", () => {
		expect(unwrapDoubleEncodedJson("hello")).toBe("hello");
	});

	it("空字符串原样返回", () => {
		expect(unwrapDoubleEncodedJson("")).toBe("");
	});
});

// ── truncateAtParagraph ────────────────────────────

describe("truncateAtParagraph", () => {
	it("不截断短文本", () => {
		expect(truncateAtParagraph("hello", 100)).toBe("hello");
	});

	it("在段落边界截断", () => {
		const text = "A".repeat(8000) + "\n\n" + "B".repeat(8000);
		const result = truncateAtParagraph(text, 10000);
		expect(result.endsWith(`...(内容已截断，共 ${text.length} 字符)`)).toBe(true);
		expect(result.includes("BBBBB")).toBe(false);
	});

	it("无段落边界时硬截断", () => {
		const text = "A".repeat(20000);
		const result = truncateAtParagraph(text, 10000);
		expect(result.includes("...(内容已截断")).toBe(true);
		expect(result.length).toBeLessThan(10100);
	});

	it("刚好不超过时完整返回", () => {
		expect(truncateAtParagraph("short", 15000)).toBe("short");
	});

	it("段落边界在限制的前半段时仍正确截断", () => {
		const text = "short first\n\n" + "B".repeat(10000);
		const result = truncateAtParagraph(text, 8000);
		expect(result.includes("...(内容已截断")).toBe(true);
		expect(result.includes("short first")).toBe(true);
		expect(result.includes("BBBBB")).toBe(false);
	});

	it("段落边界恰好在限制位置时完整保留", () => {
		const part1 = "A".repeat(5000);
		const text = part1 + "\n\n" + "B".repeat(500);
		const result = truncateAtParagraph(text, 5100);
		expect(result).toBe(text);
	});
});

// ── formatCartogResult ─────────────────────────────

describe("formatCartogResult", () => {
	it("正常 JSON 数组格式化为紧凑表格", () => {
		const input = JSON.stringify([
			{ name: "hello", kind: "function", startLine: 1, endLine: 42 },
			{ name: "main", kind: "class", startLine: 50, endLine: 120 },
		]);
		const result = formatCartogResult(input);
		expect(result).toContain("hello");
		expect(result).toContain("function");
		expect(result).toContain("L1-L42");
		expect(result).toContain("main");
		expect(result).toContain("class");
		expect(result).toContain("L50-L120");
	});

	it("空数组返回'无结果'提示", () => {
		const result = formatCartogResult("[]");
		expect(result).toContain("无结果");
	});

	it("非 JSON 输入返回原始文本", () => {
		const raw = "this is not json";
		expect(formatCartogResult(raw)).toBe(raw);
	});

	it("单个条目正确格式化", () => {
		const input = JSON.stringify([{ name: "testFunc", kind: "method", startLine: 10, endLine: 25 }]);
		const result = formatCartogResult(input);
		expect(result).toContain("testFunc");
		expect(result).toContain("method");
		expect(result).toContain("L10-L25");
	});

	it("大量条目全部显示", () => {
		const items = Array.from({ length: 50 }, (_, i) => ({
			name: `fn${i}`, kind: "function", startLine: i * 10 + 1, endLine: (i + 1) * 10,
		}));
		const result = formatCartogResult(JSON.stringify(items));
		expect(result).toContain("fn0");
		expect(result).toContain("fn49");
		expect(result.split("\n").length).toBeGreaterThanOrEqual(50);
	});

	it("缺失字段不崩溃", () => {
		const input = JSON.stringify([{ name: "x" }]);
		const result = formatCartogResult(input);
		expect(result).toContain("x");
	});
});

// ── formatBashResult ───────────────────────────────

describe("formatBashResult", () => {
	it("透传原始文本", () => {
		expect(formatBashResult("hello world")).toBe("hello world");
	});

	it("空字符串透传", () => {
		expect(formatBashResult("")).toBe("");
	});

	it("多行文本透传", () => {
		const text = "line1\nline2\nline3";
		expect(formatBashResult(text)).toBe(text);
	});
});
