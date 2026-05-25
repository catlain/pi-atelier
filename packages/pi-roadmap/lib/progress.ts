/**
 * Roadmap 进度计算与任务提取
 */

import type { RoadmapFile, Epic, Story, Task, Priority } from "./types";
import { getEffectivePriority, comparePriority } from "./types";

// ── 进度计算 ──

export interface Progress {
	total: number;
	done: number;
	percent: number;
}

/** 计算单个 roadmap 的整体进度（基于 task 粒度） */
export function calcProgress(roadmap: RoadmapFile): Progress {
	let total = 0;
	let done = 0;
	for (const epic of roadmap.epics) {
		for (const story of epic.stories) {
			for (const task of story.tasks) {
				total++;
				if (task.status === "done") done++;
			}
		}
	}
	return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** 计算 epic 进度 */
export function calcEpicProgress(epic: Epic): Progress {
	let total = 0;
	let done = 0;
	for (const story of epic.stories) {
		for (const task of story.tasks) {
			total++;
			if (task.status === "done") done++;
		}
	}
	return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** 计算 story 进度 */
export function calcStoryProgress(story: Story): Progress {
	const total = story.tasks.length;
	const done = story.tasks.filter((t) => t.status === "done").length;
	return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// ── Next 任务提取 ──

export interface NextTask extends Task {
	epicId: string;
	epicTitle: string;
	storyId: string;
	storyTitle: string;
	roadmapId: string;
	roadmapTitle: string;
}

/**
 * 提取可推进的任务
 *
 * 优先级：
 * 1. status=doing 的 task（已经在做的）
 * 2. status=todo 的 task（按 epic priority 排序）
 * 3. 限制返回数量
 */
export function getNextTasks(roadmap: RoadmapFile, limit = 5): NextTask[] {
	const candidates: NextTask[] = [];

	for (const epic of roadmap.epics) {
		// 跳过已完成/已丢弃的 epic
		if (epic.status === "done" || epic.status === "dropped") continue;

		for (const story of epic.stories) {
			if (story.status === "done" || story.status === "dropped") continue;

			// 计算有效优先级：task > story > epic
			const storyPrio = getEffectivePriority(story.priority, epic.priority);

			for (const task of story.tasks) {
				if (task.status === "todo" || task.status === "doing") {
					const taskPrio = getEffectivePriority(task.priority, storyPrio);
					candidates.push({
						...task,
						epicId: epic.id,
						epicTitle: epic.title,
						storyId: story.id,
						storyTitle: story.title,
						roadmapId: roadmap.meta.id,
						roadmapTitle: roadmap.meta.title,
					});
				}
			}
		}
	}

	// doing 优先，然后按有效优先级排序（使用存储的 task.priority 作为 effective priority）
	candidates.sort((a, b) => {
		if (a.status === "doing" && b.status !== "doing") return -1;
		if (a.status !== "doing" && b.status === "doing") return 1;
		return comparePriority(
			a.priority ?? "medium",
			b.priority ?? "medium",
		);
	});

	return candidates.slice(0, limit);
}

/** 获取所有活跃 roadmap 的 next 任务 */
export function getAllNextTasks(roadmaps: RoadmapFile[], limit = 5): NextTask[] {
	const all: NextTask[] = [];
	for (const rm of roadmaps) {
		if (rm.meta.status !== "active") continue;
		all.push(...getNextTasks(rm, limit));
	}
	// doing 优先，然后按有效优先级排序
	all.sort((a, b) => {
		if (a.status === "doing" && b.status !== "doing") return -1;
		if (a.status !== "doing" && b.status === "doing") return 1;
		return comparePriority(
			getEffectivePriority(a.priority),
			getEffectivePriority(b.priority),
		);
	});
	return all.slice(0, limit);
}

// ── 查询工具 ──

/** 按 ID 查找 task，返回其在 roadmap 中的位置 */
export function findTask(
	roadmap: RoadmapFile,
	taskId: string,
): { epic: Epic; story: Story; task: Task } | null {
	for (const epic of roadmap.epics) {
		for (const story of epic.stories) {
			for (const task of story.tasks) {
				if (task.id === taskId) {
					return { epic, story, task };
				}
			}
		}
	}
	return null;
}

/** 按 ID 查找 story */
export function findStory(
	roadmap: RoadmapFile,
	storyId: string,
): { epic: Epic; story: Story } | null {
	for (const epic of roadmap.epics) {
		for (const story of epic.stories) {
			if (story.id === storyId) {
				return { epic, story };
			}
		}
	}
	return null;
}

/** 按 ID 查找 epic */
export function findEpic(roadmap: RoadmapFile, epicId: string): Epic | null {
	return roadmap.epics.find((e) => e.id === epicId) ?? null;
}

/** 获取属于指定项目的所有 story */
export function getStoriesForProject(roadmap: RoadmapFile, projectPath: string): Story[] {
	const stories: Story[] = [];
	for (const epic of roadmap.epics) {
		if (epic.project === projectPath) {
			stories.push(...epic.stories);
		}
	}
	return stories;
}
