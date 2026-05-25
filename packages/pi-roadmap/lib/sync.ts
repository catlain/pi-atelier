/**
 * Roadmap 同步 — 全局 → 项目级
 *
 * 项目级 roadmap 是全局的子集（派生数据），可随时重新生成。
 * 同步规则：
 *   1. 从全局 roadmap 中提取 epic.project === projectPath 的 stories
 *   2. 写入项目级 .pi/roadmap/roadmap.json
 *   3. 项目级标记 done → 写回全局
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";
import type { RoadmapFile, Story, Task } from "./types";
import { PROJECT_ROADMAP_FILE, PROJECT_ROADMAP_DIR } from "./types";
import { validateRoadmap } from "./validator";
import { findTask } from "./progress";

// ── 项目级数据结构 ──

export interface ProjectRoadmap {
	/** 指向全局 roadmap 的 ID */
	source: string;
	/** 同步时间 */
	syncedAt: string;
	/** 属于当前项目的 stories（来自匹配的 epic） */
	stories: Story[];
}

// ── 全局 → 项目 ──

/** 从全局 roadmap 提取匹配项目的 stories */
export function syncToProject(
	roadmap: RoadmapFile,
	projectPath: string,
): ProjectRoadmap | null {
	const stories: Story[] = [];

	for (const epic of roadmap.epics) {
		if (epic.project === projectPath) {
			stories.push(...epic.stories);
		}
	}

	if (stories.length === 0) return null;

	return {
		source: roadmap.meta.id,
		syncedAt: new Date().toISOString().slice(0, 10),
		stories,
	};
}

/** 写入项目级 roadmap 文件 */
export function writeProjectRoadmap(
	projectPath: string,
	data: ProjectRoadmap,
): void {
	const dir = path.join(projectPath, PROJECT_ROADMAP_DIR);
	fs.mkdirSync(dir, { recursive: true });
	const filePath = path.join(dir, PROJECT_ROADMAP_FILE);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/** 读取项目级 roadmap */
export function readProjectRoadmap(projectPath: string): ProjectRoadmap | null {
	const filePath = path.join(projectPath, PROJECT_ROADMAP_DIR, PROJECT_ROADMAP_FILE);
	if (!fs.existsSync(filePath)) return null;
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

// ── 项目 → 全局（写回） ──

/**
 * 标记 task done 并写回全局 roadmap
 *
 * @param roadmapId 全局 roadmap ID
 * @param taskId 任务 ID
 * @param note 完成备注
 * @param globalDir 全局 roadmap 目录（测试时可注入）
 * @returns 是否成功
 */
export function markTaskDoneAndSyncBack(
	roadmapId: string,
	taskId: string,
	note: string,
	globalDir?: string,
): boolean {
	const dir = globalDir ?? path.join(homedir(), ".pi", "roadmap");
	const filePath = path.join(dir, `${roadmapId}.roadmap.json`);

	if (!fs.existsSync(filePath)) return false;

	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		const roadmap: RoadmapFile = JSON.parse(raw);
		const found = findTask(roadmap, taskId);
		if (!found) return false;

		found.task.status = "done";
		found.task.doneDate = new Date().toISOString().slice(0, 10);
		if (note) found.task.note = note;

		// 更新 meta.updated
		roadmap.meta.updated = new Date().toISOString().slice(0, 10);

		fs.writeFileSync(filePath, JSON.stringify(roadmap, null, 2) + "\n", "utf-8");
		return true;
	} catch {
		return false;
	}
}
