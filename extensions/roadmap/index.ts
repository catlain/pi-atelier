/**
 * Roadmap 扩展 — Epic→Story→Task 三层路线图管理
 *
 * 工具：roadmap_list / roadmap_show / roadmap_plan / roadmap_next / roadmap_done
 * Hook：before_agent_start 自动注入活跃路线图概览
 *
 * 存储：
 *   全局: ~/.pi/roadmap/<id>.roadmap.json
 *   项目: <project>/.pi/roadmap/roadmap.json（派生）
 *   归档: ~/.pi/roadmap/archive/<id>.roadmap.json
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

import { GLOBAL_ROADMAP_DIR, FILE_SUFFIX, type RoadmapFile } from "./lib/types";
import { listRoadmapFiles, readRoadmap } from "./lib/store";
import { generateInjection } from "./lib/injector";
import { registerListTool, registerShowTool } from "./lib/tools-query";
import { registerPlanTool } from "./lib/tools-plan";
import { registerNextTool, registerDoneTool } from "./lib/tools-action";

export default function roadmapExtension(pi: ExtensionAPI) {
	// ── before_agent_start hook: 注入活跃路线图概览 ──
	(pi.on as any)("before_agent_start", async (event: any) => {
		const roadmaps = loadAllRoadmaps();
		const activeRoadmaps = roadmaps.filter(
			(r: RoadmapFile) => r.meta.status === "active",
		);
		if (activeRoadmaps.length === 0) return;

		const injection = generateInjection(activeRoadmaps);
		if (!injection) return;

		// 扫描项目级 roadmap
		const cwd = event.systemPromptOptions?.cwd || process.cwd();
		const projectRoadmapPath = path.join(cwd, ".pi", "roadmap", "roadmap.json");
		let projectInjection = "";
		if (fs.existsSync(projectRoadmapPath)) {
			try {
				const projectData = JSON.parse(
					fs.readFileSync(projectRoadmapPath, "utf-8"),
				);
				projectInjection = formatProjectOverview(projectData);
			} catch {
				// 忽略损坏的项目级文件
			}
		}

		const parts = [injection];
		if (projectInjection) parts.push(`## 项目级任务\n\n${projectInjection}`);

		return {
			systemPrompt: event.systemPrompt + "\n\n" + parts.join("\n\n"),
		};
	});

	// ── 注册所有工具 ──
	registerListTool(pi);
	registerShowTool(pi);
	registerPlanTool(pi);
	registerNextTool(pi);
	registerDoneTool(pi);
}

/** 加载所有 roadmap 文件（活跃 + 归档） */
function loadAllRoadmaps(): RoadmapFile[] {
	return listRoadmapFiles()
		.map((fp) => readRoadmap(fp))
		.filter((r): r is RoadmapFile => r !== null);
}

/** 格式化项目级任务概要 */
function formatProjectOverview(data: {
	source?: string;
	stories?: Array<{
		id: string;
		title: string;
		status: string;
		tasks?: Array<{ id: string; title: string; status: string }>;
	}>;
}): string {
	if (!data.stories || data.stories.length === 0) return "";

	return data.stories
		.filter((s) => s.status !== "done" && s.status !== "dropped")
		.map((s) => {
			const taskList = (s.tasks || [])
				.filter((t) => t.status !== "done" && t.status !== "dropped")
				.map((t) => `  - [${t.status}] ${t.id}: ${t.title}`)
				.join("\n");
			return `Story ${s.id}: ${s.title} [${s.status}]\n${taskList}`;
		})
		.join("\n\n");
}
