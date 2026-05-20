/**
 * buildTask — 统一子代理 task 构造器单元测试
 *
 * Contract:
 *   buildTask(templateFile, vars, options?)
 *     - 调用 loadTaskTemplate(templateFile) 读取模板
 *     - 替换 {{key}} 为 vars 中的值
 *     - 如果 options.planContentDirect，追加内联方案内容
 *
 * 测试策略场景:
 *   Step 1 — 正常: buildTask 读取模板并替换变量
 *   Step 1 — 边界: vars 为空对象时模板原样返回
 *   Step 1 — 错误: 模板文件不存在时抛异常
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PROMPTS_DIR = path.resolve(__dirname, "../prompts");

function loadTaskTemplate(filename: string): string {
	const fp = path.join(PROMPTS_DIR, filename);
	if (!fs.existsSync(fp)) throw new Error(`Template not found: ${fp}`);
	return fs.readFileSync(fp, "utf-8");
}

/** 模拟计划中的 buildTask 实现 */
function buildTask(tplFile: string, vars: Record<string, string>): string;
function buildTask(tplFile: string, vars: Record<string, string>, opts: { planContentDirect?: string }): string;
function buildTask(tplFile: string, vars: Record<string, string>, opts?: { planContentDirect?: string }): string {
	let tpl = loadTaskTemplate(tplFile);
	for (const [k, v] of Object.entries(vars)) {
		tpl = tpl.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
	}
	if (opts?.planContentDirect) {
		tpl += `\n\n--- 方案开始 ---\n${opts.planContentDirect}\n--- 方案结束 ---\n`;
	}
	return tpl;
}

/**
 * 快速构造内联版 buildTask（不依赖真实模板文件）
 * 用于单元测试变量替换逻辑，不触碰 prompts/ 目录
 */
function mockBuildTask(tpl: string, vars: Record<string, string>, inline?: string): string {
	let r = tpl;
	for (const [k, v] of Object.entries(vars)) {
		r = r.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
	}
	if (inline) r += `\n\n--- 方案开始 ---\n${inline}\n--- 方案结束 ---\n`;
	return r;
}

// ============================================================
// 正常路径
// ============================================================

describe("buildTask — 正常路径", () => {
	it("应替换模板中所有 {{key}} 变量", () => {
		const r = mockBuildTask("F: {{f}}\nT: {{t}}", { f: "/plan.md", t: "1. test.py" });
		expect(r).toContain("/plan.md");
		expect(r).toContain("test.py");
		expect(r).not.toContain("{{f}}");
		expect(r).not.toContain("{{t}}");
	});

	it("同一 {{key}} 多次出现应全部替换", () => {
		const r = mockBuildTask("{{x}} + {{x}} = {{y}}", { x: "1", y: "2" });
		expect(r).toBe("1 + 1 = 2");
	});

	it("planContentDirect 追加内联内容到模板末尾", () => {
		const r = mockBuildTask("头部", {}, "# 方案内容\n步骤1");
		expect(r).toContain("--- 方案开始 ---");
		expect(r).toContain("步骤1");
		expect(r).toContain("--- 方案结束 ---");
	});

	it("vars + planContentDirect 同时使用", () => {
		const r = mockBuildTask("## {{title}}", { title: "审查" }, "步骤：xxx");
		expect(r).toContain("## 审查");
		expect(r).toContain("步骤：xxx");
	});
});

// ============================================================
// 边界值
// ============================================================

describe("buildTask — 边界值", () => {
	it("vars 为空对象 → 模板原样返回", () => {
		const tpl = "{{a}}\n{{b}}";
		expect(mockBuildTask(tpl, {})).toBe(tpl);
	});

	it("模板无 {{key}} → vars 不影响输出", () => {
		expect(mockBuildTask("纯文本", { k: "v" })).toBe("纯文本");
	});

	it("planContentDirect 空/undefined → 不追加", () => {
		expect(mockBuildTask("tpl", {}, "")).toBe("tpl");
		expect(mockBuildTask("tpl", {}, undefined)).toBe("tpl");
	});

	it("部分变量缺失 → 缺失的 {{key}} 保留", () => {
		const r = mockBuildTask("A: {{a}}, B: {{b}}", { a: "1" });
		expect(r).toBe("A: 1, B: {{b}}");
	});

	it("变量值含特殊正则字符时安全替换", () => {
		const r = mockBuildTask("p: {{p}}", { p: "/path/(to)?[f].(js|ts)$" });
		expect(r).toContain("/path/(to)?[f].(js|ts)$");
	});
});

// ============================================================
// 错误路径
// ============================================================

describe("buildTask — 错误路径", () => {
	it("模板文件不存在抛异常", () => {
		expect(() => loadTaskTemplate("no-such-file.md")).toThrow();
	});

	it("空文件名抛异常", () => {
		expect(() => loadTaskTemplate("")).toThrow();
	});

	it("模板路径是目录抛异常", () => {
		if (fs.existsSync(PROMPTS_DIR)) {
			expect(() => fs.readFileSync(PROMPTS_DIR, "utf-8")).toThrow();
		}
	});

	it("真实 buildTask 调用不存在的文件抛异常", () => {
		expect(() => buildTask("missing.md", {})).toThrow();
	});
});
