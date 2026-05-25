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

import { FILE_SUFFIX, type RoadmapFile } from "./lib/types";
import { listRoadmapFiles, readRoadmap } from "./lib/store";
import { generateInjection } from "./lib/injector";
import { registerListTool, registerShowTool } from "./lib/tools-query";
import { registerPlanTool } from "./lib/tools-plan";
import { registerNextTool, registerDoneTool } from "./lib/tools-action";

export default function roadmapExtension(pi: ExtensionAPI) {
	// ── 注册自定义消息渲染器 ──
	(pi.registerMessageRenderer as any)("roadmap-overview", (message: any, _expanded: boolean, theme: any) => {
		const { Container, Text } = require("@earendil-works/pi-coding-agent");
		const lines: string[] = [];

		// 标题
		lines.push(theme.bold(theme.fg("accent", "📋 项目路线图")));

		// 路线图概览
		if (message.details?.roadmaps) {
			for (const rm of message.details.roadmaps) {
				const bar = renderProgressBar(rm.progress);
				lines.push(`\n${theme.fg("accent", rm.title)} ${bar} ${rm.progress}%`);
				for (const epic of rm.epics) {
					const statusIcon = epic.status === "doing" ? "🔄" : epic.status === "done" ? "✅" : "⬜";
					lines.push(`  ${statusIcon} ${epic.id}: ${epic.title} [${epic.status}]${epic.nextTask ? ` — 下一步: ${epic.nextTask}` : ""}`);
				}
			}
		}

		// 项目级任务
		if (message.details?.projectStories?.length) {
			lines.push(theme.fg("dim", "\n项目级任务:"));
			for (const s of message.details.projectStories) {
				lines.push(`  ${s.id}: ${s.title} [${s.status}]`);
			}
		}

		lines.push(theme.fg("dim", "调用 roadmap_next 查看可执行任务。"));

		return new Text(lines.join("\n"), 0, 0);
	});

	// ── before_agent_start hook: 注入活跃路线图概览到可见消息 ──
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
		let projectStories: any[] = [];
		if (fs.existsSync(projectRoadmapPath)) {
			try {
				const projectData = JSON.parse(
					fs.readFileSync(projectRoadmapPath, "utf-8"),
				);
				projectStories = (projectData.stories || [])
					.filter((s: any) => s.status !== "done" && s.status !== "dropped");
			} catch {
				// 忽略损坏的项目级文件
			}
		}

		// 构造 details 供渲染器使用
		const details = buildDetails(activeRoadmaps, projectStories);

		return {
			// 系统提示词里只留简短指引（不可见）
			systemPrompt: event.systemPrompt + "\n\n# 项目路线图\n\n活跃路线图: " + activeRoadmaps.length + " 个\n\n调用 roadmap_next 查看可执行任务。",

			// 可见消息（用户在 TUI 中能看到）
			message: {
				customType: "roadmap-overview",
				content: injection,
				display: true,
				details,
			},
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

/** 构造渲染器需要的 details 对象 */
function buildDetails(roadmaps: RoadmapFile[], projectStories: any[]): any {
	const { calcProgress, getNextTasks } = require("./lib/progress");

	return {
		roadmaps: roadmaps.map((rm) => {
			const progress = calculateProgress(rm);
			const nextTasks = getNextTasks(rm, 1);
			return {
				title: rm.meta.title,
				progress,
				epics: rm.epics.map((epic) => ({
					id: epic.id,
					title: epic.title,
					status: epic.status,
					nextTask: nextTasks.find((t) => t.id.startsWith(epic.id + "."))?.title,
				})),
			};
		}),
		projectStories: projectStories.map((s: any) => ({
			id: s.id,
			title: s.title,
			status: s.status,
		})),
	};
}

/** 渲染进度条（10 格） */
function renderProgressBar(percent: number): string {
	const filled = Math.round(percent / 10);
	const empty = 10 - filled;
	return "■".repeat(filled) + "□".repeat(empty);
}
