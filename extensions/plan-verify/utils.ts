/**
 * PV utils.ts — 辅助函数
 *
 * 通用函数从 workflow 导入，本文件只放 PV 专用逻辑。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type OutputConstraint } from "@pi-atelier/workflow-core";
import type { Issue } from "./types";

// 通用函数 re-export
export { findSessionFile, getSubagentStatusSummary, isSubagentSuccess } from "@pi-atelier/workflow-core";

// ============================================================
// 方案文件路径管理
// ============================================================

/** 方案文件统一目录 */
export function getPlansDir(cwd: string): string {
	return path.join(cwd, ".pi", "plans");
}

/**
 * 生成标准方案文件路径。
 * 格式: .pi/plans/plan-YYYYMMDD-HHMMSS.md
 *
 * 同时创建目录（不创建文件），返回绝对路径。
 */
export function generatePlanPath(cwd: string): string {
	const plansDir = getPlansDir(cwd);
	if (!fs.existsSync(plansDir)) fs.mkdirSync(plansDir, { recursive: true });

	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
		`-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
	return path.join(plansDir, `plan-${ts}.md`);
}

/**
 * 校验方案文件路径是否合法（必须在 .pi/plans/ 下且存在）。
 * 返回 { valid, reason } 便于 handler 判断。
 */
export function validatePlanFile(
	planFile: string | undefined,
	cwd: string,
	mustExist = true,
): { valid: boolean; reason?: string } {
	if (!planFile) {
		return { valid: false, reason: "方案文件路径未设置。请先调用 pv(action: \"plan\") 启动方案设计。" };
	}

	const plansDir = getPlansDir(cwd);
	const realPlansDir = fs.existsSync(plansDir) ? fs.realpathSync(plansDir) : plansDir;
	let resolved = path.resolve(planFile);
	if (fs.existsSync(resolved)) {
		resolved = fs.realpathSync(resolved);
	}
	if (!resolved.startsWith(realPlansDir + path.sep) && resolved !== realPlansDir) {
		return {
			valid: false,
			reason:
				`方案文件必须在 .pi/plans/ 目录下（当前: ${resolved}）。\n` +
				`请将方案写入: ${plansDir}/ 下的文件。使用 pv(action: "plan") 可自动生成合法路径。`,
		};
	}

	if (mustExist && !fs.existsSync(resolved)) {
		return { valid: false, reason: `方案文件不存在: ${resolved}。请先写入方案文件。` };
	}

	return { valid: true };
}

// ============================================================
// PV 专用辅助函数
// ============================================================

// 问题提取
// ============================================================

/** 从子代理输出中提取结构化问题清单（JSON 优先） */
export function extractIssues(text: string): { issues: Issue[]; parseError: boolean } {
	const match = text.match(/<!-- ISSUES_JSON\n([\s\S]*?)\n-->/);
	if (!match) {
		return { issues: [], parseError: true };
	}

	try {
		const arr = JSON.parse(match[1]);
		if (!Array.isArray(arr)) {
			return { issues: [], parseError: true };
		}

		const issues: Issue[] = arr
			.filter((item: any) =>
				item &&
				["critical", "warning", "suggestion"].includes(item.severity) &&
				typeof item.description === "string" &&
				item.description.length >= 5
			)
			.map((item: any) => ({
				severity: item.severity,
				category: item.category || "general",
				description: item.description.substring(0, 500),
				suggestion: item.suggestion || undefined,
			}));

		return { issues, parseError: false };
	} catch {
		return { issues: [], parseError: true };
	}
}

/** 输出格式约束：要求子代理在审查输出末尾包含结构化 JSON 问题清单 */
export const ISSUES_JSON_CONSTRAINT: OutputConstraint = {
	rule:
		"审查结果末尾必须包含结构化的问题清单（HTML 注释中的 JSON 数组），格式如下：\n" +
		"<!-- ISSUES_JSON\n" +
		"[{\"severity\":\"critical\",\"description\":\"问题描述\",\"suggestion\":\"建议\"}]\n" +
		"-->\n" +
		"每个 issue 必须有 severity（critical/warning/suggestion）和 description（≥5字符）。\n" +
		"如果没有发现任何问题，输出空数组：<!-- ISSUES_JSON\n[]\n-->",
	validate: (output: string): string | null => {
		const match = output.match(/<!-- ISSUES_JSON\n([\s\S]*?)\n-->/);
		if (!match) return "缺少 <!-- ISSUES_JSON --> 块。在输出末尾添加结构化问题清单。";
		try {
			const arr = JSON.parse(match[1]);
			if (!Array.isArray(arr)) return "ISSUES_JSON 内容必须是 JSON 数组";
			for (const item of arr) {
				if (!["critical", "warning", "suggestion"].includes(item.severity)) {
					return `无效 severity: ${item.severity}，只能是 critical/warning/suggestion`;
				}
				if (!item.description || item.description.length < 5) {
					return "每个 issue 的 description 不能为空且至少 5 字符";
				}
			}
		} catch (e: any) {
			return `JSON 解析失败: ${e.message}`;
		}
		return null;
	},
};

/** 公共约束：回溯旧问题禁止使用标签格式（防 extractIssues 误匹配） */
export const NO_RETRO_LABEL_CONSTRAINT: OutputConstraint = {
	rule: "回溯旧问题部分禁止使用 [Critical]/[Warning] 标签，只能用 \"✅ 已修正\" 或 \"❌ 未修正\"。只有新发现的审查问题才用标签格式。",
	validate: (output: string) => {
		const lines = output.split("\n");
		for (const line of lines) {
			if ((/[✅]/.test(line) || /已修正/.test(line)) && /\[(Critical|Warning)\]/i.test(line)) {
				return `回溯已修正的问题行中包含 [Critical]/[Warning] 标签: ${line.substring(0, 80)}`;
			}
		}
		return null;
	},
};

// 公共：方案来源解析 + task 构建
// ============================================================

/** 解析方案来源：params.plan_file 或 state.planFile，文件必须存在 */
export function resolvePlanSource(
	params: { plan_file?: string; plan_content?: string },
	state: { planFile?: string; planContent?: string },
): { planFile: string | undefined; planContentDirect: string } {
	const planFile = params.plan_file || state.planFile;
	let planContentDirect = "";

	if (planFile && fs.existsSync(planFile)) {
		// 文件存在，正常
	} else if (params.plan_content) {
		planContentDirect = params.plan_content;
	} else if (state.planContent) {
		planContentDirect = state.planContent;
	}

	return { planFile, planContentDirect };
}

/** 读取 prompts/ 目录下的任务模板文件 */
export function loadTaskTemplate(filename: string): string {
	const promptsDir = path.join(__dirname, "prompts");
	return fs.readFileSync(path.join(promptsDir, filename), "utf-8");
}

/**
 * 统一构建子代理 task：加载模板、替换 {{key}} 变量、可选项追加内联方案内容。
 *
 * - 模板文件用 loadTaskTemplate 加载
 * - vars 中的每个 key 替换模板中对应的 {{key}}
 * - options.planContentDirect 非空时追加到模板末尾（内联模式）
 */
export function buildTask(
	templateFile: string,
	vars: Record<string, string>,
	options?: { planContentDirect?: string },
): string {
	let tpl = loadTaskTemplate(templateFile);
	for (const [k, v] of Object.entries(vars)) {
		tpl = tpl.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
	}
	if (options?.planContentDirect) {
		tpl += `\n\n--- 方案开始 ---\n${options.planContentDirect}\n--- 方案结束 ---\n`;
	}
	return tpl;
}

export function extractCategory(text: string): string {
	if (text.includes("测试")) return "测试完备性";
	if (text.includes("架构")) return "架构";
	if (text.includes("安全")) return "安全";
	if (text.includes("性能")) return "性能";
	if (text.includes("可行")) return "可行性";
	if (text.includes("完整")) return "完整性";
	if (text.includes("可维护")) return "可维护性";
	if (text.includes("重复模式") || text.includes("抽象")) return "重复模式与抽象度";
	return "general";
}
