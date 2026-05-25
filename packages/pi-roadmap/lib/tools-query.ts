/**
 * Roadmap 工具 — list + show
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import type { RoadmapFile } from "./types";
import { GLOBAL_ROADMAP_DIR, ARCHIVE_DIR } from "./types";
import { listRoadmapFiles, readRoadmap, getRoadmapFilePath } from "./store";
import { getOverview, formatProgress } from "./parser";

export function registerListTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_list",
		label: "Roadmap List",
		description: "列出所有路线图及进度概览。可选按状态或标签过滤。",
		parameters: Type.Object({
			status: Type.Optional(
				Type.String({ description: "按状态过滤: active/paused/completed/archived" }),
			),
			tag: Type.Optional(Type.String({ description: "按标签过滤" })),
		}),
		async execute(
			_toolCallId: string,
			params: { status?: string; tag?: string },
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			let roadmaps = listRoadmapFiles()
				.map((fp) => readRoadmap(fp))
				.filter((r): r is RoadmapFile => r !== null);

			if (params.status === "archived") {
				const archiveDir = path.join(GLOBAL_ROADMAP_DIR, ARCHIVE_DIR);
				if (fs.existsSync(archiveDir)) {
					roadmaps = roadmaps.concat(
						fs.readdirSync(archiveDir)
							.filter((f) => f.endsWith(".roadmap.json"))
							.map((f) => readRoadmap(path.join(archiveDir, f)))
							.filter((r): r is RoadmapFile => r !== null),
					);
				}
			}

			if (params.status) {
				roadmaps = roadmaps.filter((r: RoadmapFile) => r.meta.status === params.status);
			}
			if (params.tag) {
				roadmaps = roadmaps.filter((r: RoadmapFile) => r.meta.tags.includes(params.tag!));
			}

			if (roadmaps.length === 0) {
				return { content: [{ type: "text" as const, text: "没有找到路线图。使用 roadmap_plan 创建新的路线图。" }], details: {} };
			}

			const text = roadmaps
				.map((rm: RoadmapFile) => {
					const overview = getOverview(rm);
					const bar = formatProgress(overview.percent);
					const epicLines = rm.epics.map((epic) => {
						const storyCount = epic.stories.length;
						const taskCount = epic.stories.reduce((sum, s) => sum + s.tasks.length, 0);
						const doneTasks = epic.stories.reduce(
							(sum, s) => sum + s.tasks.filter((t) => t.status === "done").length,
							0,
						);
						return (
							`  ${epic.id} [${epic.status}/${epic.priority}] ${epic.title}\n` +
							`    Stories: ${storyCount} | Tasks: ${doneTasks}/${taskCount}`
						);
					}).join("\n");

					return (
						`### ${overview.title} (${overview.status}) ${bar} ${overview.percent}%\n` +
						`ID: ${overview.id} | Tags: ${overview.tags.join(", ") || "无"}\n` +
						epicLines
					);
				})
				.join("\n\n");

			return { content: [{ type: "text" as const, text }], details: {} };
		},
	});
}

export function registerShowTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_show",
		label: "Roadmap Show",
		description: "查看某个路线图的完整详情，包括所有 Epic/Story/Task。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
		}),
		async execute(
			_toolCallId: string,
			params: { roadmapId: string },
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const filePath = getRoadmapFilePath(params.roadmapId);
			if (!filePath) {
				return { content: [{ type: "text" as const, text: `路线图 "${params.roadmapId}" 不存在。` }], details: {} };
			}

			const roadmap = readRoadmap(filePath);
			if (!roadmap) {
				return { content: [{ type: "text" as const, text: `路线图 "${params.roadmapId}" 读取失败。` }], details: {} };
			}

			return { content: [{ type: "text" as const, text: formatRoadmapDetail(roadmap) }], details: {} };
		},
	});
}

/** 格式化路线图详情文本 */
export function formatRoadmapDetail(roadmap: RoadmapFile): string {
	const overview = getOverview(roadmap);
	const bar = formatProgress(overview.percent);

	let output = `# ${overview.title} ${bar} ${overview.percent}%\n`;
	output += `Status: ${overview.status} | Tags: ${overview.tags.join(", ") || "无"}\n\n`;

	for (const epic of roadmap.epics) {
		output += `## Epic ${epic.id}: ${epic.title} [${epic.status}/${epic.priority}]\n`;
		output += `${epic.description}\n`;
		output += `Project: ${epic.project || "未指定"}\n\n`;

		for (const story of epic.stories) {
			output += `### Story ${story.id}: ${story.title} [${story.status}]\n`;
			output += `${story.description}\n`;
			if (story.tasks.length === 0) {
				output += "  (暂无 Task)\n";
			}
			for (const task of story.tasks) {
				const check =
					task.status === "done" ? "✅" :
					task.status === "doing" ? "🔄" :
					task.status === "blocked" ? "🚫" :
					task.status === "dropped" ? "❌" : "⬜";
				const note = task.note ? ` — ${task.note}` : "";
				const date = task.doneDate ? ` (${task.doneDate})` : "";
				output += `  ${check} ${task.id}: ${task.title}${date}${note}\n`;
			}
			output += "\n";
		}
	}

	return output;
}
