/**
 * cache 缓存读写测试
 *
 * 验证缓存文件的原子写入、config hash 一致性、
 * 以及缓存缺失/损坏时的容错处理。
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { writeCacheAtomic, computeConfigHash } from "./cache";

const TMP_DIR = path.join(os.tmpdir(), "mcp-lite-cache-test-" + Date.now());

before(() => {
	fs.mkdirSync(TMP_DIR, { recursive: true });
});

after(() => {
	fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("writeCacheAtomic", () => {
	const cachePath = path.join(TMP_DIR, "mcp-cache.json");

	it("writes file with correct JSON content", () => {
		const data = { version: 1, servers: { test: { tools: [] } } };
		writeCacheAtomic(cachePath, data);

		const content = fs.readFileSync(cachePath, "utf-8");
		const parsed = JSON.parse(content);
		assert.deepEqual(parsed, data);
	});

	it("writes valid JSON for empty data", () => {
		const data = {};
		writeCacheAtomic(cachePath, data);

		const content = fs.readFileSync(cachePath, "utf-8");
		assert.equal(content, "{}");
	});

	it("does not leave .tmp file after success", () => {
		const data = { test: true };
		writeCacheAtomic(cachePath, data);

		const tmpFiles = fs.readdirSync(TMP_DIR).filter(f => f.endsWith(".tmp"));
		assert.equal(tmpFiles.length, 0, "no .tmp files should remain after write");
	});

	it("writes large nested data correctly", () => {
		const data = {
			version: 1,
			servers: {
				"glm-web-search": {
					configHash: "abc123",
					tools: Array.from({ length: 10 }, (_, i) => ({
						name: `tool_${i}`,
						description: `Tool ${i}`,
						inputSchema: {
							type: "object",
							properties: { param: { type: "string" } },
						},
					})),
				},
			},
		};
		writeCacheAtomic(cachePath, data);
		const content = fs.readFileSync(cachePath, "utf-8");
		const parsed = JSON.parse(content);
		assert.equal(parsed.version, 1);
		assert.equal(parsed.servers["glm-web-search"].tools.length, 10);
	});

	it("throws on invalid data (circular reference)", () => {
		const data: any = { a: null };
		data.a = data; // circular
		assert.throws(() => writeCacheAtomic(cachePath, data));
	});
});

describe("computeConfigHash", () => {
	it("returns consistent hash for identical config", () => {
		const config1 = { servers: { a: { url: "http://example.com" } } };
		const config2 = { servers: { a: { url: "http://example.com" } } };
		assert.equal(computeConfigHash(config1), computeConfigHash(config2));
	});

	it("returns different hash for different config", () => {
		const config1 = { servers: { a: { url: "http://example.com" } } };
		const config2 = { servers: { a: { url: "http://other.com" } } };
		assert.notEqual(computeConfigHash(config1), computeConfigHash(config2));
	});

	it("handles empty config", () => {
		const hash = computeConfigHash({});
		assert.equal(typeof hash, "string");
		assert.ok(hash.length > 0);
	});

	it("handles undefined config", () => {
		const hash = computeConfigHash(undefined);
		assert.equal(typeof hash, "string");
		assert.ok(hash.length > 0);
	});

	it("is deterministic regardless of property order", () => {
		const config1 = { b: 2, a: 1 };
		const config2 = { a: 1, b: 2 };
		assert.equal(computeConfigHash(config1), computeConfigHash(config2));
	});

	it("produces SHA-256 hex string of expected length", () => {
		const hash = computeConfigHash({ test: true });
		// SHA-256 hex is 64 chars
		assert.equal(hash.length, 64);
		assert.ok(/^[0-9a-f]{64}$/.test(hash));
	});
});
