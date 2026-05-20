/**
 * tool-builder 工具注册构建测试
 *
 * 验证：
 * - 工具名直接使用全名（{server}_{tool}）
 * - description 格式（包含参数说明）
 * - 缓存缺失/损坏时的容错
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
	buildToolDefinition,
	getToolsFromCache,
} from "./tool-builder";

const TMP_DIR = path.join(os.tmpdir(), "mcp-lite-tb-test-" + Date.now());

before(() => {
	fs.mkdirSync(TMP_DIR, { recursive: true });
});

after(() => {
	fs.rmSync(TMP_DIR, { recursive: true, force: true });
});



describe("buildToolDefinition", () => {
	it("generates description with parameter details", () => {
		const tool = {
			name: "web_search_prime",
			description: "Search the web",
			inputSchema: {
				type: "object",
				properties: {
					search_query: {
						type: "string",
						description: "Search query",
					},
					content_size: {
						type: "string",
						enum: ["medium", "high"],
					},
				},
				required: ["search_query"],
			},
		};

		const def = buildToolDefinition(tool, "glm-web-search");
		assert.ok(def.description.includes("参数:"));
		assert.ok(def.description.includes("search_query (string, 必填)"));
		assert.ok(def.description.includes("content_size (string)"));
	});

	it("includes optional parameters without '(必填)'", () => {
		const tool = {
			name: "test_tool",
			description: "A test tool",
			inputSchema: {
				type: "object",
				properties: {
					param1: { type: "string" },
					param2: { type: "number", description: "Optional number" },
				},
				required: [],
			},
		};

		const def = buildToolDefinition(tool, "test-server");
		assert.ok(!def.description.includes("(必填)"));
	});

	it("handles schema with no properties", () => {
		const tool = {
			name: "empty_tool",
			description: "No params",
			inputSchema: {
				type: "object",
				properties: {},
				required: [],
			},
		};

		const def = buildToolDefinition(tool, "test-server");
		assert.ok(def.description.includes("No params"));
	});

	it("preserves inputSchema as raw JSON", () => {
		const tool = {
			name: "raw_schema_tool",
			description: "Test raw schema",
			inputSchema: {
				type: "object",
				properties: {
					url: { type: "string", description: "The URL" },
				},
				required: ["url"],
			},
		};

		const def = buildToolDefinition(tool, "test-server");
		assert.equal(def.parameters, tool.inputSchema);
	});

	it("generates unique full tool names per server", () => {
		const tool1 = buildToolDefinition(
			{ name: "web_search_prime", description: "Search", inputSchema: {} },
			"glm-web-search",
		);
		const tool2 = buildToolDefinition(
			{ name: "web_search_prime", description: "Search", inputSchema: {} },
			"glm-web-reader",
		);
		// Different servers → different full names
		assert.equal(tool1.name, "glm_web_search_web_search_prime");
		assert.equal(tool2.name, "glm_web_reader_web_search_prime");
	});
});

describe("getToolsFromCache", () => {
	it("returns tools when cache exists", () => {
		const cachePath = path.join(TMP_DIR, "valid-cache.json");
		const cacheData = {
			version: 1,
			servers: {
				"glm-web-search": {
					configHash: "abc",
					tools: [
						{
							name: "web_search_prime",
							description: "Search",
							inputSchema: { type: "object" },
						},
					],
				},
			},
		};
		fs.writeFileSync(cachePath, JSON.stringify(cacheData), "utf-8");

		const result = getToolsFromCache(cachePath);
		assert.equal(result.length, 1);
		assert.equal(result[0].name, "web_search_prime");
	});

	it("returns empty list when cache file missing", () => {
		const result = getToolsFromCache("/nonexistent/cache.json");
		assert.deepEqual(result, []);
	});

	it("returns empty list when cache JSON is malformed", () => {
		const cachePath = path.join(TMP_DIR, "bad-cache.json");
		fs.writeFileSync(cachePath, "this is not json", "utf-8");

		const result = getToolsFromCache(cachePath);
		assert.deepEqual(result, []);
	});

	it("returns empty list when servers object is empty", () => {
		const cachePath = path.join(TMP_DIR, "empty-servers-cache.json");
		fs.writeFileSync(cachePath, JSON.stringify({ version: 1, servers: {} }), "utf-8");

		const result = getToolsFromCache(cachePath);
		assert.deepEqual(result, []);
	});

	it("returns empty list when version is missing", () => {
		const cachePath = path.join(TMP_DIR, "no-version-cache.json");
		fs.writeFileSync(cachePath, JSON.stringify({ servers: { s: { tools: [{ name: "t" }] } } }), "utf-8");

		const result = getToolsFromCache(cachePath);
		assert.deepEqual(result, []);
	});

	it("returns empty list when servers has no tools array", () => {
		const cachePath = path.join(TMP_DIR, "no-tools-cache.json");
		fs.writeFileSync(cachePath, JSON.stringify({ version: 1, servers: { s: {} } }), "utf-8");

		const result = getToolsFromCache(cachePath);
		assert.deepEqual(result, []);
	});
});
