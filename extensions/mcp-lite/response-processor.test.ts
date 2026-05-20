/**
 * response-processor 后处理测试
 *
 * 覆盖：双重编码 JSON 解包、webReader 格式化/截断/兜底、
 * webSearch 格式化/限制/兜底、pass-through、fallback
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { processResponse, truncateAtParagraph, unwrapDoubleEncodedJson } from "./response-processor";

// ── 双重编码解包 ──────────────────────────────────

describe("unwrapDoubleEncodedJson", () => {
	it("解包双重编码的 JSON 对象", () => {
		const raw = JSON.stringify(JSON.stringify({ title: "test" }));
		const result = unwrapDoubleEncodedJson(raw);
		assert.equal(result, JSON.stringify({ title: "test" }));
	});

	it("解包双重编码的 JSON 数组", () => {
		const raw = JSON.stringify(JSON.stringify([{ title: "a" }]));
		const result = unwrapDoubleEncodedJson(raw);
		assert.equal(result, JSON.stringify([{ title: "a" }]));
	});

	it("非双重编码时原样返回", () => {
		const raw = JSON.stringify({ title: "test" });
		assert.equal(unwrapDoubleEncodedJson(raw), raw);
	});

	it("非 JSON 文本原样返回", () => {
		assert.equal(unwrapDoubleEncodedJson("hello"), "hello");
	});
});

// ── 截断工具 ──────────────────────────────────────

describe("truncateAtParagraph", () => {
	it("不截断短文本", () => {
		assert.equal(truncateAtParagraph("hello", 100), "hello");
	});

	it("在段落边界截断", () => {
		const text = "A".repeat(8000) + "\n\n" + "B".repeat(8000);
		const result = truncateAtParagraph(text, 10000);
		assert.ok(result.endsWith(`...(内容已截断，共 ${text.length} 字符)`));
		assert.ok(!result.includes("BBBBB"), "截断后不应包含第二段内容");
	});

	it("无段落边界时硬截断", () => {
		const text = "A".repeat(20000);
		const result = truncateAtParagraph(text, 10000);
		assert.ok(result.includes("...(内容已截断"));
		assert.ok(result.length < 10100, "截断后长度应接近限制");
	});

	it("刚好不超过时完整返回", () => {
		assert.equal(truncateAtParagraph("short", 15000), "short");
	});
});

// ── webReader 后处理 ──────────────────────────────

describe("processResponse — glm-web-reader/webReader", () => {
	// 模拟 GLM MCP 返回的双重编码 JSON
	function doubleEncode(obj: unknown): string {
		return JSON.stringify(JSON.stringify(obj));
	}

	it("提取 title+url+content，去掉 metadata 和 external", () => {
		const raw = doubleEncode({
			title: "测试网页标题",
			url: "https://example.com/test",
			content: "这是网页正文内容。",
			metadata: { "og:title": "噪声", "og:image": "噪声" },
			external: { stylesheet: { "/style.css": {} } },
		});
		const result = processResponse("glm-web-reader", "webReader", raw);
		assert.ok(result.includes("标题: 测试网页标题"));
		assert.ok(result.includes("URL: https://example.com/test"));
		assert.ok(result.includes("这是网页正文内容。"));
		assert.ok(!result.includes("og:title"));
		assert.ok(!result.includes("stylesheet"));
	});

	it("content 超过 MAX_CONTENT_CHARS 时按段落边界截断", () => {
		const longContent = "A".repeat(16000) + "\n\n" + "B".repeat(5000);
		const raw = doubleEncode({
			title: "长文",
			url: "https://example.com/long",
			content: longContent,
		});
		const result = processResponse("glm-web-reader", "webReader", raw);
		assert.ok(result.includes("...(内容已截断"));
		assert.ok(!result.includes("BBBBB"), "不应包含截断后的内容");
	});

	it("content 为空字符串", () => {
		const raw = doubleEncode({ title: "空页", url: "https://x.com", content: "" });
		const result = processResponse("glm-web-reader", "webReader", raw);
		assert.ok(result.includes("标题: 空页"));
		assert.ok(result.includes("URL: https://x.com"));
		assert.equal(result.split("\n").length, 2);
	});

	it("缺少 content 字段时不崩溃", () => {
		const raw = doubleEncode({ title: "无内容", url: "https://x.com" });
		const result = processResponse("glm-web-reader", "webReader", raw);
		assert.ok(result.includes("标题: 无内容"));
	});

	it("缺少 title 字段时不崩溃", () => {
		const raw = doubleEncode({ url: "https://x.com", content: "正文" });
		const result = processResponse("glm-web-reader", "webReader", raw);
		assert.ok(result.includes("URL: https://x.com"));
		assert.ok(result.includes("正文"));
	});
});

// ── web_search 后处理 ──────────────────────────────

describe("processResponse — glm-web-search/web_search_prime", () => {
	function doubleEncode(obj: unknown): string {
		return JSON.stringify(JSON.stringify(obj));
	}

	it("格式化搜索结果", () => {
		const raw = doubleEncode([
			{ title: "结果1", link: "https://a.com", content: "摘要1", refer: "ref_1" },
			{ title: "结果2", link: "https://b.com", content: "摘要2", refer: "ref_2" },
		]);
		const result = processResponse("glm-web-search", "web_search_prime", raw);
		assert.ok(result.includes("搜索结果（共 2 条）"));
		assert.ok(result.includes("[1] 结果1"));
		assert.ok(result.includes("URL: https://a.com"));
		assert.ok(result.includes("摘要1"));
		assert.ok(result.includes("[2] 结果2"));
	});

	it("超过 8 条时只显示前 8 条", () => {
		const results = Array.from({ length: 12 }, (_, i) => ({
			title: `结果${i + 1}`,
			link: `https://${i}.com`,
			content: `摘要${i + 1}`,
		}));
		const raw = doubleEncode(results);
		const result = processResponse("glm-web-search", "web_search_prime", raw);
		assert.ok(result.includes("共 12 条"));
		assert.ok(result.includes("显示前 8 条"));
		assert.ok(result.includes("[8]"));
		assert.ok(!result.includes("[9]"));
	});

	it("空数组返回 0 条提示", () => {
		const raw = doubleEncode([]);
		const result = processResponse("glm-web-search", "web_search_prime", raw);
		assert.ok(result.includes("共 0 条"));
	});

	it("结果缺少 link 字段时不崩溃", () => {
		const raw = doubleEncode([{ title: "无链接", content: "摘要" }]);
		const result = processResponse("glm-web-search", "web_search_prime", raw);
		assert.ok(result.includes("[1] 无链接"));
		assert.ok(result.includes("URL: "));
	});

	it("结果缺少 title 字段时不崩溃", () => {
		const raw = doubleEncode([{ link: "https://x.com", content: "摘要" }]);
		const result = processResponse("glm-web-search", "web_search_prime", raw);
		assert.ok(result.includes("URL: https://x.com"));
	});

	it("结果缺少 content 字段时省略摘要行", () => {
		const raw = doubleEncode([{ title: "无摘要", link: "https://x.com" }]);
		const result = processResponse("glm-web-search", "web_search_prime", raw);
		assert.ok(result.includes("[1] 无摘要"));
		assert.ok(result.includes("URL: https://x.com"));
	});
});

// ── pass-through ──────────────────────────────────

describe("processResponse — pass-through", () => {
	it("zread search_doc 原样返回", () => {
		const raw = "some search doc output";
		assert.equal(processResponse("glm-zread", "search_doc", raw), raw);
	});

	it("vision analyze_image 原样返回", () => {
		const raw = "some vision output";
		assert.equal(processResponse("glm-vision", "analyze_image", raw), raw);
	});

	it("未知服务器 + 工具组合原样返回", () => {
		const raw = "unknown";
		assert.equal(processResponse("unknown-server", "unknown-tool", raw), raw);
	});
});

// ── fallback ──────────────────────────────────────

describe("processResponse — fallback", () => {
	it("无效 JSON 返回原始文本", () => {
		const raw = "this is not json at all";
		assert.equal(processResponse("glm-web-reader", "webReader", raw), raw);
	});

	it("JSON 解析失败对 web_search 也返回原始文本", () => {
		const raw = "broken {json";
		assert.equal(processResponse("glm-web-search", "web_search_prime", raw), raw);
	});
});
