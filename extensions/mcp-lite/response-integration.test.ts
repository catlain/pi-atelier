/**
 * 后处理集成测试
 *
 * 验证 setupMcpLite 注册的 execute 回调确实应用了 response-processor 后处理。
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { setupMcpLite } from "./index";

const TMP_DIR = path.join(os.tmpdir(), "mcp-lite-response-integ-test-" + Date.now());

before(() => {
	fs.mkdirSync(TMP_DIR, { recursive: true });
});

describe("setupMcpLite - response processing integration", () => {
	const readerCachePath = path.join(TMP_DIR, "reader-integration-cache.json");
	const readerConfigPath = path.join(TMP_DIR, "reader-integration-mcp.json");

	before(() => {
		fs.writeFileSync(readerConfigPath, JSON.stringify({ servers: {} }), "utf-8");
		fs.writeFileSync(
			readerCachePath,
			JSON.stringify({
				version: 1,
				servers: {
					"glm-web-reader": {
						configHash: "test-hash",
						tools: [{
							name: "webReader",
							description: "Read web page",
							inputSchema: {
								type: "object",
								properties: { url: { type: "string" } },
								required: ["url"],
							},
						}],
					},
				},
			}),
			"utf-8",
		);
	});

	it("execute 回调应用了后处理（格式化 webReader JSON）", async () => {
		const rawJson = JSON.stringify({
			title: "测试页",
			url: "https://example.com",
			content: "正文内容",
			metadata: { "og:title": "噪声" },
			external: { stylesheet: {} },
		});

		const mockClient = {
			getServerNames: () => ["glm-web-reader"],
			resetAllConnections: () => {},
			execute: async () => ({
				content: [{ type: "text", text: rawJson }],
				details: {},
			}),
		} as any;

		let capturedResult: any = null;
		const mockRegister = (def: any) => {
			capturedResult = def;
			return { name: def.name };
		};

		setupMcpLite(readerConfigPath, readerCachePath, mockRegister, { client: mockClient });
		const result = await capturedResult.execute("test-id", { url: "https://example.com" });

		assert.ok(result.content[0].text.includes("标题: 测试页"), "应包含格式化标题");
		assert.ok(result.content[0].text.includes("URL: https://example.com"), "应包含格式化 URL");
		assert.ok(!result.content[0].text.includes("og:title"), "不应包含 metadata 噪声");
		assert.ok(!result.content[0].text.includes("stylesheet"), "不应包含 external 噪声");
	});

	it("execute 回调后处理失败时 fallback 到原始内容", async () => {
		const errorMsg = "MCP 服务器连接失败: timeout";

		const mockClient = {
			getServerNames: () => ["glm-web-reader"],
			resetAllConnections: () => {},
			execute: async () => ({
				content: [{ type: "text", text: errorMsg }],
				details: {},
			}),
		} as any;

		let capturedResult: any = null;
		const mockRegister = (def: any) => {
			capturedResult = def;
			return { name: def.name };
		};

		setupMcpLite(readerConfigPath, readerCachePath, mockRegister, { client: mockClient });
		const result = await capturedResult.execute("test-id", { url: "https://example.com" });

		assert.equal(result.content[0].text, errorMsg, "应返回原始错误消息");
	});
});
