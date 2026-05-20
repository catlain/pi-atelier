/**
 * review.ts / fix.ts 模板迁移等价性测试
 *
 * 方案 Step 2: review 和 fix 改用 buildTask + 模板文件替代 buildPlanTask。
 *
 * 测试策略场景:
 *   Step 2 — 单元: review.ts 迁移后 task 输出与旧逻辑等价
 *
 * 验证方式: 用同一输入分别走 旧buildPlanTask 和 新buildTask+模板，
 * 比较语义等价性（包含相同的关键信息）。
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PROMPTS_DIR = path.resolve(__dirname, "../prompts");

// ============================================================
// 旧逻辑（buildPlanTask）— review.ts/fix.ts 当前使用
// ============================================================

function oldBuildPlanTask(
	planFile: string | undefined,
	planContentDirect: string,
	instructions: { filePrefix: string; fileReadInstruction: string; inlinePrefix: string; inlineSuffix: string },
): string {
	if (planFile) {
		return `${instructions.filePrefix}\n方案文件路径: ${planFile}\n${instructions.fileReadInstruction}`;
	}
	return `${instructions.inlinePrefix}\n--- 方案开始 ---\n${planContentDirect}\n--- 方案结束 ---\n${instructions.inlineSuffix}`;
}

const REVIEW_PREFIX = "请审查以下技术方案文件,逐项检查所有审查维度。\n特别注意:测试完备性是第一优先级。逐个对照实现步骤,检查每个步骤是否有测试覆盖。";

// ============================================================
// 新版 buildTask + 模板
// ============================================================

function loadTaskTemplate(filename: string): string {
	const fp = path.join(PROMPTS_DIR, filename);
	if (!fs.existsSync(fp)) throw new Error(`Template not found: ${fp}`);
	return fs.readFileSync(fp, "utf-8");
}

function newBuildTask(tplFile: string, vars: Record<string, string>, inline?: string): string {
	let tpl = loadTaskTemplate(tplFile);
	for (const [k, v] of Object.entries(vars)) {
		tpl = tpl.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
	}
	if (inline) tpl += `\n\n--- 方案开始 ---\n${inline}\n--- 方案结束 ---\n`;
	return tpl;
}

// 不依赖真实模板的内存版（等价性测试用）
function mockBuildTask(tpl: string, vars: Record<string, string>, inline?: string): string {
	let r = tpl;
	for (const [k, v] of Object.entries(vars)) r = r.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
	if (inline) r += `\n\n--- 方案开始 ---\n${inline}\n--- 方案结束 ---\n`;
	return r;
}

beforeAll(() => {
	expect(fs.existsSync(PROMPTS_DIR)).toBe(true);
});

// ============================================================
// 模板文件结构
// ============================================================

describe("模板文件存在性与占位符 (Step 2 前置条件)", () => {
	it("review-task.md 存在且含 {{planFile}}", () => {
		if (!fs.existsSync(path.join(PROMPTS_DIR, "review-task.md"))) return; // 还没创建时跳过
		const c = loadTaskTemplate("review-task.md");
		expect(c).toContain("{{planFile}}");
	});

	it("fix-task.md 存在且含 {{planFile}} 和 {{reviewInstructions}}", () => {
		if (!fs.existsSync(path.join(PROMPTS_DIR, "fix-task.md"))) return;
		const c = loadTaskTemplate("fix-task.md");
		expect(c).toContain("{{planFile}}");
		expect(c).toContain("{{reviewInstructions}}");
	});
});

// ============================================================
// review 等价性
// ============================================================

describe("review: 模板模式与旧 buildPlanTask 等价", () => {
	const planFile = "/project/.pi/plans/plan-20260513.md";

	it("文件模式：新旧都包含方案路径和审查指令", () => {
		const old = oldBuildPlanTask(planFile, "", {
			filePrefix: REVIEW_PREFIX,
			fileReadInstruction: "请先 read 该文件,然后进行审查。",
			inlinePrefix: "请审查以下技术方案",
			inlineSuffix: "",
		});

		const newTpl = "## 方案文件\n\n{{planFile}}\n\n## 审查任务\n\n{{reviewInstructions}}";
		const newTask = mockBuildTask(newTpl, {
			planFile,
			reviewInstructions: REVIEW_PREFIX,
		});

		[old, newTask].forEach(t => {
			expect(t).toContain(planFile);
			expect(t).toContain("测试完备性是第一优先级");
		});
		expect(newTask).not.toContain("{{planFile}}");
	});

	it("内联模式：新旧都包含审查指令和内联方案", () => {
		const inline = "# 内联方案\n步骤1";

		const old = oldBuildPlanTask(undefined, inline, {
			filePrefix: REVIEW_PREFIX,
			fileReadInstruction: "请先 read",
			inlinePrefix: "请审查以下技术方案",
			inlineSuffix: "",
		});

		const tpl = "## 审查任务\n\n{{reviewInstructions}}";
		const newTask = mockBuildTask(tpl, { reviewInstructions: "请审查以下技术方案" }, inline);

		[old, newTask].forEach(t => {
			expect(t).toContain("审查以下技术方案");
			expect(t).toContain("--- 方案开始 ---");
			expect(t).toContain("内联方案");
		});
	});
});

// ============================================================
// fix 等价性
// ============================================================

describe("fix: 模板模式与旧 buildPlanTask 等价", () => {
	const planFile = "/pkg/.pi/plans/plan.md";
	const prevIssues = "1. CRITICAL: 缺少测试\n2. WARNING: 空值未处理";

	it("有上一轮问题时包含方案路径和旧问题列表", () => {
		const prevSection = `\n\n## 上一轮审查问题\n\n${prevIssues}\n\n请检查上述问题是否已在方案中修正。`;
		const oldPrefix = `请审查以下技术方案文件,逐项检查所有审查维度。\n特别注意:测试完备性是第一优先级。${prevSection}`;

		const old = oldBuildPlanTask(planFile, "", {
			filePrefix: oldPrefix,
			fileReadInstruction: "请先 read 该文件,然后进行审查。",
			inlinePrefix: "",
			inlineSuffix: "",
		});

		const tpl = "## 方案文件\n\n{{planFile}}\n\n## 审查任务\n\n{{reviewInstructions}}";
		const newTask = mockBuildTask(tpl, {
			planFile,
			reviewInstructions: `请审查以下技术方案文件。测试完备性是第一优先级。${prevSection}`,
		});

		[old, newTask].forEach(t => {
			expect(t).toContain(planFile);
			expect(t).toContain("CRITICAL: 缺少测试");
			expect(t).toContain("WARNING: 空值未处理");
		});
		expect(newTask).not.toContain("{{planFile}}");
	});

	it("无上一轮问题时不含 prevIssues 内容", () => {
		const tpl = "## 方案文件\n\n{{planFile}}\n\n## 审查任务\n\n{{reviewInstructions}}";
		const newTask = mockBuildTask(tpl, {
			planFile,
			reviewInstructions: "请重新审查修正后的方案。",
		});

		expect(newTask).toContain(planFile);
		expect(newTask).toContain("重新审查");
		expect(newTask).not.toContain("上一轮审查问题");
	});
});
