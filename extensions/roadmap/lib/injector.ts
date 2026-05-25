/**
 * Roadmap 注入 — before_agent_start 自动生成概览文本
 *
 * 注入策略：
 *   - 只注入活跃 roadmap 的概览（≤200 token）
 *   - 每个 Epic 只显示 1 个"下一步"
 *   - 详情按需 roadmap_show
 */

import type { RoadmapFile } from "./types";
import { calcProgress } from "./progress";
import { getNextTasks } from "./progress";
import { filterByStatus, formatProgress } from "./parser";

export interface InjectionConfig {
	/** 是否显示进度条 */
	showProgressBar?: boolean;
	/** 每个 roadmap 最多显示几个 next 任务 */
	maxNextPerRoadmap?: number;
	/** 最大注入行数 */
	maxLines?: number;
}

/** 生成注入文本 */
export function generateInjection(
	roadmaps: RoadmapFile[],
	config: InjectionConfig = {},
): string {
	const {
		showProgressBar = true,
		maxNextPerRoadmap = 3,
		maxLines = 20,
	} = config;

	const active = filterByStatus(roadmaps, "active");
	if (active.length === 0) return "";

	const lines: string[] = [];
	lines.push("# 项目路线图");
	lines.push("");

	for (const rm of active) {
		const progress = calcProgress(rm);
		const bar = showProgressBar ? ` ${formatProgress(progress.percent)}` : "";
		lines.push(`## ${rm.meta.title} ${bar} ${progress.percent}%`);
		lines.push("");

		// 每个 epic 一行状态
		const allNextTasks = getNextTasks(rm, maxNextPerRoadmap);

		for (const epic of rm.epics) {
			if (epic.status === "done" || epic.status === "dropped") continue;
			const nextForEpic = allNextTasks.filter((t) => t.epicId === epic.id);
			const statusLabel = epic.status === "doing" ? "doing" : "todo";
			const nextHint =
				nextForEpic.length > 0
					? ` — 下一步: ${nextForEpic[0].title}`
					: "";
			lines.push(
				`  Epic ${epic.id} ${epic.title} [${statusLabel}]${nextHint}`,
			);
		}
		lines.push("");
	}

	// 截断控制
	if (lines.length > maxLines) {
		lines.length = maxLines;
		lines.push("... (截断，调用 roadmap_show 查看详情)");
	}

	lines.push("调用 roadmap_next 查看可执行任务。");

	return lines.join("\n");
}
