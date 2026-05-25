/**
 * Roadmap 数据验证与修复
 */

import type { RoadmapFile } from "./types";

const VALID_ROADMAP_STATUS = new Set(["active", "paused", "completed", "archived"]);
const VALID_ITEM_STATUS = new Set(["todo", "doing", "done", "blocked", "dropped"]);
const VALID_PRIORITY = new Set(["low", "medium", "high"]);

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

/** 验证 roadmap 数据结构 */
export function validateRoadmap(data: unknown): ValidationResult {
	const errors: string[] = [];

	if (!data || typeof data !== "object") {
		return { valid: false, errors: ["数据不是对象"] };
	}

	const d = data as Record<string, unknown>;

	// meta 检查
	if (!d.meta || typeof d.meta !== "object") {
		errors.push("缺少 meta 字段");
	} else {
		const meta = d.meta as Record<string, unknown>;
		if (!meta.id || typeof meta.id !== "string") errors.push("meta.id 缺失或非字符串");
		if (!meta.title || typeof meta.title !== "string") errors.push("meta.title 缺失或非字符串");
		if (!meta.status || !VALID_ROADMAP_STATUS.has(meta.status as string))
			errors.push(`meta.status "${meta.status}" 不合法`);
		if (!meta.created || typeof meta.created !== "string") errors.push("meta.created 缺失");
		if (!meta.updated || typeof meta.updated !== "string") errors.push("meta.updated 缺失");
	}

	// epics 检查
	if (!Array.isArray(d.epics)) {
		errors.push("缺少 epics 数组");
	} else {
		const epicIds = new Set<string>();
		for (let i = 0; i < d.epics.length; i++) {
			const epic = d.epics[i] as Record<string, unknown>;
			if (!epic.id) errors.push(`epics[${i}].id 缺失`);
			else if (epicIds.has(epic.id as string)) errors.push(`epic id "${epic.id}" 重复`);
			else epicIds.add(epic.id as string);

			if (!epic.title) errors.push(`epics[${i}].title 缺失`);
			if (epic.project !== undefined && typeof epic.project !== "string") errors.push(`epics[${i}].project 类型错误`);
			if (!VALID_ITEM_STATUS.has(epic.status as string))
				errors.push(`epics[${i}].status "${epic.status}" 不合法`);
			if (!VALID_PRIORITY.has(epic.priority as string))
				errors.push(`epics[${i}].priority "${epic.priority}" 不合法`);

			if (!Array.isArray(epic.stories)) {
				errors.push(`epics[${i}].stories 不是数组`);
			} else {
				const storyIds = new Set<string>();
				for (let j = 0; j < epic.stories.length; j++) {
					const story = epic.stories[j] as Record<string, unknown>;
					if (!story.id) errors.push(`epics[${i}].stories[${j}].id 缺失`);
					else if (storyIds.has(story.id as string))
						errors.push(`story id "${story.id}" 在 epic ${epic.id} 内重复`);
					else storyIds.add(story.id as string);

					if (!story.title) errors.push(`epics[${i}].stories[${j}].title 缺失`);
					if (!VALID_ITEM_STATUS.has(story.status as string))
						errors.push(`epics[${i}].stories[${j}].status 不合法`);

					if (!Array.isArray(story.tasks)) {
						errors.push(`epics[${i}].stories[${j}].tasks 不是数组`);
					} else {
						const taskIds = new Set<string>();
						for (let k = 0; k < story.tasks.length; k++) {
							const task = story.tasks[k] as Record<string, unknown>;
							if (!task.id) errors.push(`task[${k}].id 缺失`);
							else if (taskIds.has(task.id as string))
								errors.push(`task id "${task.id}" 在 story ${story.id} 内重复`);
							else taskIds.add(task.id as string);

							if (!task.title) errors.push(`task[${k}].title 缺失`);
							if (!VALID_ITEM_STATUS.has(task.status as string))
								errors.push(`task[${k}].status 不合法`);
						}
					}
				}
			}
		}
	}

	return { valid: errors.length === 0, errors };
}

/** 尝试修复常见问题（轻量修复） */
export function repairRoadmap(data: any): RoadmapFile | null {
	try {
		if (!data.meta) data.meta = {};
		if (!data.meta.id) return null;
		if (!data.meta.title) data.meta.title = data.meta.id;
		if (!data.meta.status || !VALID_ROADMAP_STATUS.has(data.meta.status))
			data.meta.status = "active";
		if (!data.meta.created) data.meta.created = new Date().toISOString().slice(0, 10);
		if (!data.meta.updated) data.meta.updated = data.meta.created;
		if (!Array.isArray(data.meta.tags)) data.meta.tags = [];

		if (!Array.isArray(data.epics)) data.epics = [];

		for (const epic of data.epics) {
			if (!VALID_ITEM_STATUS.has(epic.status)) epic.status = "todo";
			if (!VALID_PRIORITY.has(epic.priority)) epic.priority = "medium";
			if (!epic.project) epic.project = "";
			if (!Array.isArray(epic.stories)) epic.stories = [];

			for (const story of epic.stories) {
				if (!VALID_ITEM_STATUS.has(story.status)) story.status = "todo";
				if (!Array.isArray(story.tasks)) story.tasks = [];

				for (const task of story.tasks) {
					if (!VALID_ITEM_STATUS.has(task.status)) task.status = "todo";
				}
			}
		}

		return data as RoadmapFile;
	} catch {
		return null;
	}
}
