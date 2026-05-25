/**
 * Roadmap 工具 — plan（创建/更新路线图）
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import * as path from "node:path";

import type { RoadmapFile } from "./types";
import { GLOBAL_ROADMAP_DIR } from "./types";
import { writeRoadmap, getRoadmapFilePath } from "./store";
import { syncToProject, writeProjectRoadmap } from "./sync";

/** 加载提示词文件 */
function loadPrompt(filename: string): string {
	const promptsDir = path.join(__dirname, "..", "prompts");
	const filePath = path.join(promptsDir, filename);
	if (!fs.existsSync(filePath)) return "";
	return fs.readFileSync(filePath, "utf-8").trim();
}

export function registerPlanTool(pi: ExtensionAPI) {
	const planDescription = loadPrompt("plan-description.md");

	pi.registerTool({
		name: "roadmap_plan",
		label: "Roadmap Plan",
		description:
			planDescription ||
			"创建或更新路线图。从讨论中提炼意图，拆解为 Epic→Story→Task。",
		parameters: Type.Object({
			roadmapId: Type.String({
				description: "路线图 ID（slug 格式，如 pi-atelier-split）",
			}),
			content: Type.Any({ description: "完整的 roadmap JSON 对象" }),
			action: Type.Union([Type.Literal("create"), Type.Literal("update")], {
				description: "create=新建，update=更新已有",
			}),
		}),
		async execute(
			_toolCallId: string,
			params: {
				roadmapId: string;
				content: unknown;
				action: "create" | "update";
			},
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			_ctx: unknown,
		) {
			const { roadmapId, action } = params;
			let { content } = params;

			// 兼容 LLM 传字符串的情况
			if (typeof content === "string") {
				try { content = JSON.parse(content); } catch { /* fallback below */ }
			}

			if (!content || typeof content !== "object") {
				return { content: [{ type: "text" as const, text: "错误：content 必须是有效的 JSON 对象。" }], details: {} };
			}

			const roadmap = content as RoadmapFile;

			if (!roadmap.meta?.id || !roadmap.meta?.title) {
				return { content: [{ type: "text" as const, text: "错误：meta.id 和 meta.title 必填。" }], details: {} };
			}

			roadmap.meta.updated = new Date().toISOString().slice(0, 10);
			fs.mkdirSync(GLOBAL_ROADMAP_DIR, { recursive: true });

			const filePath = getRoadmapFilePath(roadmapId);
			writeRoadmap(filePath, roadmap);

			// 同步到关联项目
			const syncResults: string[] = [];
			for (const epic of roadmap.epics) {
				if (epic.project) {
					const projectData = syncToProject(roadmap, epic.project);
					if (projectData) {
						writeProjectRoadmap(epic.project, projectData);
						syncResults.push(
							`同步到项目 ${epic.project}（${projectData.stories.length} stories）`,
						);
					}
				}
			}

			const actionLabel = action === "create" ? "创建" : "更新";
			let text = `路线图 "${roadmap.meta.title}" 已${actionLabel}。`;
			if (syncResults.length > 0) {
				text += `\n\n同步：\n${syncResults.map((s) => `- ${s}`).join("\n")}`;
			}
			return { content: [{ type: "text" as const, text }], details: {} };
		},
	});
}
