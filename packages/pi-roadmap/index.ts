/**
 * Roadmap 扩展 — Epic→Story→Task 三层路线图管理
 *
 * 工具：roadmap_list / roadmap_show / roadmap_plan / roadmap_next / roadmap_done
 *
 * 存储：
 *   全局: ~/.pi/roadmap/<id>.roadmap.json
 *   项目: <project>/.pi/roadmap/roadmap.json（派生）
 *   归档: ~/.pi/roadmap/archive/<id>.roadmap.json
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerListTool, registerShowTool } from "./lib/tools-query";
import { registerPlanTool } from "./lib/tools-plan";
import { registerNextTool, registerDoneTool } from "./lib/tools-action";

export default function roadmapExtension(pi: ExtensionAPI) {
	// ── 注册所有工具 ──
	registerListTool(pi);
	registerShowTool(pi);
	registerPlanTool(pi);
	registerNextTool(pi);
	registerDoneTool(pi);
}
