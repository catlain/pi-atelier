/**
 * Roadmap 查询、过滤、汇总
 */

import type { RoadmapFile, RoadmapStatus, Epic } from "./types";
import { calcProgress, calcEpicProgress } from "./progress";

// ── 过滤 ──

/** 按路线图状态过滤 */
export function filterByStatus(
	roadmaps: RoadmapFile[],
	status: RoadmapStatus,
): RoadmapFile[] {
	return roadmaps.filter((r) => r.meta.status === status);
}

/** 按标签过滤 */
export function filterByTag(roadmaps: RoadmapFile[], tag: string): RoadmapFile[] {
	return roadmaps.filter((r) => r.meta.tags.includes(tag));
}

// ── 汇总 ──

export interface EpicOverview {
	id: string;
	title: string;
	status: string;
	priority: string;
	totalTasks: number;
	doneTasks: number;
	percent: number;
}

export interface RoadmapOverview {
	id: string;
	title: string;
	status: string;
	tags: string[];
	totalTasks: number;
	doneTasks: number;
	percent: number;
	epics: EpicOverview[];
}

/** 获取路线图概览（含各 Epic 进度） */
export function getOverview(roadmap: RoadmapFile): RoadmapOverview {
	const overall = calcProgress(roadmap);

	const epics: EpicOverview[] = roadmap.epics.map((epic) => {
		const prog = calcEpicProgress(epic);
		return {
			id: epic.id,
			title: epic.title,
			status: epic.status,
			priority: epic.priority,
			totalTasks: prog.total,
			doneTasks: prog.done,
			percent: prog.percent,
		};
	});

	return {
		id: roadmap.meta.id,
		title: roadmap.meta.title,
		status: roadmap.meta.status,
		tags: roadmap.meta.tags,
		totalTasks: overall.total,
		doneTasks: overall.done,
		percent: overall.percent,
		epics,
	};
}

// ── 格式化 ──

/** 生成进度条字符串，10 格宽度 */
export function formatProgress(percent: number): string {
	const filled = Math.round(percent / 10);
	const empty = 10 - filled;
	return `[${"■".repeat(filled)}${"□".repeat(empty)}]`;
}
