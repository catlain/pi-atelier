/**
 * Roadmap 拆解辅助 — 提示词加载、变量替换、ID 生成
 *
 * 提示词模板存放在 prompts/ 目录，用 {{变量名}} 占位。
 * 参考 plan-verify 的 loadTaskTemplate + buildTask 模式。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Epic, Story, Task } from "./types";

// ── 提示词加载 ──

/** 加载单个提示词文件内容 */
export function loadPrompt(filename: string, promptsDir?: string): string {
	const dir = promptsDir ?? getDefaultPromptsDir();
	const filePath = path.join(dir, filename);
	return fs.readFileSync(filePath, "utf-8");
}

/** 加载提示词并替换变量（{{key}} → value） */
export function buildPrompt(
	filename: string,
	vars: Record<string, string>,
	promptsDir?: string,
): string {
	let tpl = loadPrompt(filename, promptsDir);
	for (const [k, v] of Object.entries(vars)) {
		tpl = tpl.replace(new RegExp(`\\{\\{${escapeRegExp(k)}\\}\\}`, "g"), v);
	}
	return tpl;
}

/** 列出 prompts 目录下所有 .md 文件 */
export function listAvailablePrompts(promptsDir?: string): string[] {
	const dir = promptsDir ?? getDefaultPromptsDir();
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.sort();
}

/** 获取默认 prompts 目录（extensions/roadmap/prompts/） */
function getDefaultPromptsDir(): string {
	return path.join(__dirname, "..", "prompts");
}

// ── ID 生成 ──

/** 生成下一个 Epic ID（取已有最大编号 +1） */
export function generateNextEpicId(epics: Pick<Epic, "id">[]): string {
	let max = 0;
	for (const epic of epics) {
		const match = epic.id.match(/^E(\d+)$/);
		if (match) max = Math.max(max, parseInt(match[1], 10));
	}
	return `E${max + 1}`;
}

/** 生成下一个 Story ID */
export function generateNextStoryId(
	epicId: string,
	stories: Pick<Story, "id">[],
): string {
	let max = 0;
	for (const story of stories) {
		const match = story.id.match(/^E\d+\.S(\d+)$/);
		if (match) max = Math.max(max, parseInt(match[1], 10));
	}
	return `${epicId}.S${max + 1}`;
}

/** 生成下一个 Task ID */
export function generateNextTaskId(
	storyId: string,
	tasks: Pick<Task, "id">[],
): string {
	let max = 0;
	for (const task of tasks) {
		const match = task.id.match(/^E\d+\.S\d+\.T(\d+)$/);
		if (match) max = Math.max(max, parseInt(match[1], 10));
	}
	return `${storyId}.T${max + 1}`;
}

// ── 工具函数 ──

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
