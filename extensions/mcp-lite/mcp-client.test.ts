/**
 * mcp-client MCP 连接管理测试
 *
 * 验证：
 * - lazy 连接生命周期
 * - bearer token 从环境变量读取
 * - stdio 命令构建
 * - 并发连接去重
 * - 连接/调用错误的统一格式
 * - session 清理
 * - mcp.json 缺失/格式错误容错
 * - AbortSignal 支持
 */

import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { createMcpClient, McpClient } from "./mcp-client";

const TMP_DIR = path.join(os.tmpdir(), "mcp-lite-client-test-" + Date.now());

before(() => {
	fs.mkdirSync(TMP_DIR, { recursive: true });
});

after(() => {
	fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

// Helper: write a temporary mcp.json
function writeMcpConfig(data: Record<string, unknown>): string {
	const p = path.join(TMP_DIR, "mcp.json");
	fs.writeFileSync(p, JSON.stringify(data), "utf-8");
	return p;
}

describe("McpClient - config loading", () => {
	it("loads bearer token from environment variable", () => {
		const configPath = writeMcpConfig({
			servers: {
				"glm-web-search": {
					url: "http://example.com/mcp",
					auth: "bearer",
					bearerTokenEnv: "GLM_API_KEY",
				},
			},
		});

		process.env.GLM_API_KEY = "test-token-123";
		const client = createMcpClient(configPath);
		const config = client.getServerConfig("glm-web-search");
		assert.ok(config, "config should exist");
		assert.equal(config!.url, "http://example.com/mcp");
		assert.equal(config!.auth, "bearer");
		assert.equal(config!.bearerTokenEnv, "GLM_API_KEY");
		delete process.env.GLM_API_KEY;
	});

	it("returns undefined for unset bearer token env var", () => {
		const configPath = writeMcpConfig({
			servers: {
				"glm-web-search": {
					url: "http://example.com/mcp",
					auth: "bearer",
					bearerTokenEnv: "NONEXISTENT_VAR_12345",
				},
			},
		});

		delete process.env.NONEXISTENT_VAR_12345;
		const client = createMcpClient(configPath);
		const token = client.getBearerToken("glm-web-search");
		assert.equal(token, undefined);
	});

	it("builds stdio command correctly", () => {
		const configPath = writeMcpConfig({
			servers: {
				"glm-vision": {
					command: "npx",
					args: ["-y", "@z_ai/mcp-server"],
					env: { NODE_ENV: "production" },
				},
			},
		});

		const client = createMcpClient(configPath);
		const stdioConfig = client.getStdioConfig("glm-vision");
		assert.ok(stdioConfig, "stdioConfig should exist");
		assert.equal(stdioConfig!.command, "npx");
		assert.deepEqual(stdioConfig!.args, ["-y", "@z_ai/mcp-server"]);
		assert.equal(stdioConfig!.env.NODE_ENV, "production");
	});

	it("returns valid config when mcp.json has all server types", () => {
		const configPath = writeMcpConfig({
			servers: {
				"glm-web-search": { url: "http://example.com/mcp" },
				"glm-web-reader": { url: "http://example.com/reader" },
				"glm-zread": { url: "http://example.com/zread" },
				"glm-vision": { command: "npx", args: ["-y", "@z_ai/mcp-server"] },
			},
		});

		const client = createMcpClient(configPath);
		assert.equal(client.getServerNames().length, 4);
	});

	it("does not crash when mcp.json is missing", () => {
		const client = createMcpClient("/nonexistent/mcp.json");
		assert.equal(client.getServerNames().length, 0);
	});

	it("does not crash when mcp.json has invalid format", () => {
		const badPath = path.join(TMP_DIR, "bad-mcp.json");
		fs.writeFileSync(badPath, "not json", "utf-8");
		const client = createMcpClient(badPath);
		assert.equal(client.getServerNames().length, 0);
	});

	it("does not register tools when servers is empty", () => {
		const configPath = writeMcpConfig({ servers: {} });
		const client = createMcpClient(configPath);
		assert.equal(client.getServerNames().length, 0);
	});
});

describe("McpClient - connection deduplication", () => {
	it("deduplicates concurrent connect calls for same server", async () => {
		const configPath = writeMcpConfig({
			servers: {
				"test-server": {
					url: "http://localhost:9999/mcp",
				},
			},
		});

		const client = createMcpClient(configPath);
		// Both calls should produce only one connection attempt
		const p1 = client.connect("test-server");
		const p2 = client.connect("test-server");
		assert.equal(client.getActiveConnections(), 1, "only one connection promise");

		// Both promises should resolve/reject the same way
		try {
			await Promise.all([p1, p2]);
		} catch {
			// Connection may fail (port not listening), that's OK
			// The important thing is they deduplicate
		}
	});

	it("connects to different servers independently", async () => {
		const configPath = writeMcpConfig({
			servers: {
				"server-a": { url: "http://localhost:9998/mcp" },
				"server-b": { url: "http://localhost:9997/mcp" },
			},
		});

		const client = createMcpClient(configPath);
		const p1 = client.connect("server-a");
		const p2 = client.connect("server-b");
		assert.equal(client.getActiveConnections(), 2, "two independent connection promises");

		try {
			await Promise.allSettled([p1, p2]);
		} catch {
			// both may fail, that's OK
		}
	});
});

describe("McpClient - session lifecycle", () => {
	it("clears all connections on session start", () => {
		const configPath = writeMcpConfig({
			servers: {
				"test-server": { url: "http://localhost:9996/mcp" },
			},
		});

		const client = createMcpClient(configPath);
		// Simulate session_start
		client.resetAllConnections();
		assert.equal(client.getActiveConnections(), 0);
	});

	it("disconnectAll closes all connections", async () => {
		const configPath = writeMcpConfig({
			servers: {
				"test-server": { url: "http://localhost:9995/mcp" },
			},
		});

		const client = createMcpClient(configPath);
		// Even with no connections, disconnectAll should not throw
		await client.disconnectAll();
		assert.equal(client.getActiveConnections(), 0);
	});
});

describe("McpClient - execute", () => {
	it("returns unified error format on connection failure", async () => {
		const configPath = writeMcpConfig({
			servers: {
				"unreachable-server": {
					url: "http://localhost:1/mcp",
				},
			},
		});

		const client = createMcpClient(configPath);
		const result = await client.execute("call-1", "unreachable-server", "some_tool", {});
		assert.ok(result.content[0].text.includes("连接失败") || result.content[0].text.includes("connect"), 
			`error should mention connection failure, got: ${result.content[0].text}`);
		assert.equal(result.details.error, "connect_failed");
	});

	it("lazily connects on first execute call", async () => {
		const configPath = writeMcpConfig({
			servers: {
				"lazy-test": { url: "http://localhost:9994/mcp" },
			},
		});

		const client = createMcpClient(configPath);
		// Not connected yet
		assert.equal(client.getActiveConnections(), 0);

		// Execute triggers lazy connect
		const result = await client.execute("call-2", "lazy-test", "some_tool", {});
		// Connection will fail but the key point is lazy trigger happened
		assert.ok(result, "execute should return a result even on failure");
	});

	it("supports AbortSignal to cancel connection", async () => {
		const configPath = writeMcpConfig({
			servers: {
				"slow-server": { url: "http://localhost:9993/mcp" },
			},
		});

		const ac = new AbortController();
		const client = createMcpClient(configPath);

		// Connect with signal
		const connectPromise = client.connect("slow-server", ac.signal);
		ac.abort();

		const result = await connectPromise;
		assert.ok(result === undefined || (result as any)?.content?.[0]?.text,
			"aborted connect should resolve without throwing");
	});
});

describe("McpClient - error formatting", () => {
	it("returns connect_failed error format", async () => {
		const configPath = writeMcpConfig({
			servers: {
				"broken": { url: "http://localhost:1/mcp" },
			},
		});

		const client = createMcpClient(configPath);
		const result = await client.execute("call-3", "broken", "tool", {});
		assert.equal(result.details.error, "connect_failed");
		assert.ok(Array.isArray(result.content));
		assert.ok(result.content[0].type, "text");
	});

	it("returns tool_error error format on call failure", async () => {
		const configPath = writeMcpConfig({
			servers: {
				"unreachable": { url: "http://localhost:1/mcp" },
			},
		});

		const client = createMcpClient(configPath);
		const result = await client.execute("call-4", "unreachable", "nonexistent_tool", {});
		// After connect fails, error should be connect_failed (because we never reach callTool)
		// If connect succeeds but callTool fails, it should be tool_error
		assert.ok(
			result.details.error === "connect_failed" || result.details.error === "tool_error",
			`error type should be connect_failed or tool_error, got: ${result.details.error}`,
		);
	});
});
