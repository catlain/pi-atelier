/**
 * Roadmap 工具 — next（获取可推进任务）+ done（标记完成）
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { existsSync } from "node:fs";

import type { RoadmapFile } from "./types";
import { GLOBAL_ROADMAP_DIR } from "./types";
import { listRoadmapFiles, readRoadmap, writeRoadmap, getRoadmapFilePath } from "./store";
import { getNextTasks } from "./progress";
import { syncToProject, writeProjectRoadmap } from "./sync";

export function registerNextTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_next",
		label: "Roadmap Next",
		description:
			"获取当前可推进的任务列表。按优先级排序，doing 优先于 todo，high 优先于 medium/low。",
		parameters: Type.Object({
			roadmapId: Type.Optional(
				Type.String({ description: "指定路线图 ID，不填则查所有活跃路线图" }),
			),
			limit: Type.Optional(
				Type.Number({ description: "最多返回几个任务，默认 5" }),
			),
		}),
		async execute(
			_toolCallId: string,
			params: { roadmapId?: string; limit?: number },
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const { limit = 5 } = params;

			let roadmaps: RoadmapFile[];
			if (params.roadmapId) {
				const rm = readRoadmap(getRoadmapFilePath(params.roadmapId));
				if (!rm) {
					return { content: [{ type: "text" as const, text: `路线图 "${params.roadmapId}" 不存在。` }], details: {} };
				}
				roadmaps = [rm];
			} else {
				roadmaps = listRoadmapFiles()
					.map((fp) => readRoadmap(fp))
					.filter((r): r is RoadmapFile => r !== null)
					.filter((r: RoadmapFile) => r.meta.status === "active");
			}

			if (roadmaps.length === 0) {
				return { content: [{ type: "text" as const, text: "没有活跃的路线图。" }], details: {} };
			}

			const allNext = roadmaps
				.map((rm: RoadmapFile) => ({ roadmap: rm, tasks: getNextTasks(rm, limit) }))
				.filter((item) => item.tasks.length > 0);

			if (allNext.length === 0) {
				return { content: [{ type: "text" as const, text: "当前没有待推进的任务。" }], details: {} };
			}

			const text = allNext
				.map((item) => {
					const header = `## ${item.roadmap.meta.title}`;
					const taskList = item.tasks
						.map(
							(t) =>
								`- [${t.status}] ${t.id}: ${t.title} (Epic: ${t.epicTitle})`,
						)
						.join("\n");
					return `${header}\n${taskList}`;
				})
				.join("\n\n");

			return { content: [{ type: "text" as const, text }], details: {} };
		},
	});
}

export function registerDoneTool(pi: ExtensionAPI) {
	pi.registerTool({
		name: "roadmap_done",
		label: "Roadmap Done",
		description: "标记路线图中的某个任务为完成。会自动同步到关联项目。",
		parameters: Type.Object({
			roadmapId: Type.String({ description: "路线图 ID" }),
			taskId: Type.String({ description: "任务 ID，如 E1.S1.T1" }),
			note: Type.Optional(
				Type.String({ description: "完成备注或产出链接" }),
			),
		}),
		async execute(
			_toolCallId: string,
			params: { roadmapId: string; taskId: string; note?: string },
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const filePath = getRoadmapFilePath(params.roadmapId);
			if (!existsSync(filePath)) {
				return { content: [{ type: "text" as const, text: `路线图 "${params.roadmapId}" 不存在。` }], details: {} };
			}

			const roadmap = readRoadmap(filePath);
			if (!roadmap) {
				return { content: [{ type: "text" as const, text: `路线图 "${params.roadmapId}" 读取失败。` }], details: {} };
			}

			let found = false;
			for (const epic of roadmap.epics) {
				for (const story of epic.stories) {
					for (const task of story.tasks) {
						if (task.id === params.taskId) {
							task.status = "done";
							task.doneDate = new Date().toISOString().slice(0, 10);
							if (params.note) task.note = params.note;
							found = true;
							break;
						}
					}
					if (found) break;
				}
				if (found) break;
			}

			if (!found) {
				return { content: [{ type: "text" as const, text: `任务 "${params.taskId}" 在路线图 "${params.roadmapId}" 中不存在。` }], details: {} };
			}

			roadmap.meta.updated = new Date().toISOString().slice(0, 10);
			writeRoadmap(filePath, roadmap);

			// 同步到关联项目
			const synced: string[] = [];
			for (const epic of roadmap.epics) {
				if (epic.project) {
					const projectData = syncToProject(roadmap, epic.project);
					if (projectData) {
						writeProjectRoadmap(epic.project, projectData);
						synced.push(epic.project);
					}
				}
			}

			let result = `✅ 任务 "${params.taskId}" 已标记完成。`;
			if (synced.length > 0) {
				result += `\n已同步到项目: ${synced.join(", ")}`;
			}
			return { content: [{ type: "text" as const, text: result }], details: {} };
		},
	});
}
