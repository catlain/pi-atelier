/**
 * planner.ts 测试 — 提示词加载 + 变量替换 + 拆解辅助
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
	loadPrompt,
	buildPrompt,
	listAvailablePrompts,
	generateNextEpicId,
	generateNextStoryId,
	generateNextTaskId,
} from "../lib/planner";

// ── 测试用的临时 prompts 目录 ──

const TEST_PROMPTS_DIR = path.join(os.tmpdir(), "roadmap-test-prompts");

beforeEach(() => {
	fs.mkdirSync(TEST_PROMPTS_DIR, { recursive: true });
});

afterEach(() => {
	fs.rmSync(TEST_PROMPTS_DIR, { recursive: true, force: true });
});

// ── loadPrompt / buildPrompt ──

describe("loadPrompt", () => {
	it("加载存在的提示词文件", () => {
		fs.writeFileSync(
			path.join(TEST_PROMPTS_DIR, "test.md"),
			"你好 {{name}}",
		);
		const result = loadPrompt("test.md", TEST_PROMPTS_DIR);
		expect(result).toBe("你好 {{name}}");
	});

	it("文件不存在时抛出错误", () => {
		expect(() => loadPrompt("nonexistent.md", TEST_PROMPTS_DIR)).toThrow();
	});
});

describe("buildPrompt", () => {
	it("替换单个变量", () => {
		fs.writeFileSync(
			path.join(TEST_PROMPTS_DIR, "greet.md"),
			"你好 {{name}}，欢迎",
		);
		const result = buildPrompt("greet.md", { name: "Alice" }, TEST_PROMPTS_DIR);
		expect(result).toBe("你好 Alice，欢迎");
	});

	it("替换多个变量", () => {
		fs.writeFileSync(
			path.join(TEST_PROMPTS_DIR, "multi.md"),
			"{{a}} 和 {{b}} 和 {{c}}",
		);
		const result = buildPrompt("multi.md", { a: "1", b: "2", c: "3" }, TEST_PROMPTS_DIR);
		expect(result).toBe("1 和 2 和 3");
	});

	it("同一变量多次出现全部替换", () => {
		fs.writeFileSync(
			path.join(TEST_PROMPTS_DIR, "repeat.md"),
			"{{x}} + {{x}} = 2*{{x}}",
		);
		const result = buildPrompt("repeat.md", { x: "7" }, TEST_PROMPTS_DIR);
		expect(result).toBe("7 + 7 = 2*7");
	});

	it("未提供的变量保持原样", () => {
		fs.writeFileSync(
			path.join(TEST_PROMPTS_DIR, "partial.md"),
			"{{a}} {{b}}",
		);
		const result = buildPrompt("partial.md", { a: "hello" }, TEST_PROMPTS_DIR);
		expect(result).toBe("hello {{b}}");
	});
});

describe("listAvailablePrompts", () => {
	it("列出 prompts 目录下所有 .md 文件", () => {
		fs.writeFileSync(path.join(TEST_PROMPTS_DIR, "a.md"), "");
		fs.writeFileSync(path.join(TEST_PROMPTS_DIR, "b.md"), "");
		fs.writeFileSync(path.join(TEST_PROMPTS_DIR, "c.txt"), "");
		const result = listAvailablePrompts(TEST_PROMPTS_DIR);
		expect(result).toEqual(["a.md", "b.md"]);
	});

	it("目录不存在返回空数组", () => {
		const result = listAvailablePrompts(path.join(os.tmpdir(), "nonexistent"));
		expect(result).toEqual([]);
	});
});

// ── ID 生成 ──

describe("generateNextEpicId", () => {
	it("空 epics 返回 E1", () => {
		expect(generateNextEpicId([])).toBe("E1");
	});

	it("已有 E1 E2 返回 E3", () => {
		expect(generateNextEpicId([{ id: "E1" } as any, { id: "E2" } as any])).toBe("E3");
	});

	it("已有 E1 E3 返回 E4（取最大值+1）", () => {
		expect(generateNextEpicId([{ id: "E1" } as any, { id: "E3" } as any])).toBe("E4");
	});
});

describe("generateNextStoryId", () => {
	it("空 stories 返回 E1.S1", () => {
		expect(generateNextStoryId("E1", [])).toBe("E1.S1");
	});

	it("已有 S1 S2 返回 S3", () => {
		expect(
			generateNextStoryId("E2", [{ id: "E2.S1" } as any, { id: "E2.S2" } as any]),
		).toBe("E2.S3");
	});
});

describe("generateNextTaskId", () => {
	it("空 tasks 返回 E1.S1.T1", () => {
		expect(generateNextTaskId("E1.S1", [])).toBe("E1.S1.T1");
	});

	it("已有 T1 T2 返回 T3", () => {
		expect(
			generateNextTaskId("E1.S2", [
				{ id: "E1.S2.T1" } as any,
				{ id: "E1.S2.T2" } as any,
			]),
		).toBe("E1.S2.T3");
	});
});
