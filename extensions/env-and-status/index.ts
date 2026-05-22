/**
 * 环境变量注入 + Session ID + Cartog 聚合索引
 *
 * 核心思路：
 *   在项目根目录 cartog-ext/ 放外部目录的软链接
 *   从项目根目录直接索引，路径都是项目根相对，与 MCP serve 完全一致
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { updateSessionStatus, updateSessionSizeStatus, updateMemoryStatus } from "./lib/status";
import { registerCartogHooks, registerCartogCommands } from "./lib/cartog-hook";

export default function (pi: ExtensionAPI) {
	// 当前 cwd，供 cartog tool_call 拦截使用
	const currentCwd = { value: "" };

	// ── Session/turn 状态更新 ─────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		updateSessionStatus(ctx);
	});

	pi.on("turn_start", async (_event, ctx) => {
		updateSessionStatus(ctx);
		updateSessionSizeStatus(ctx);
		updateMemoryStatus(ctx);
	});

	// ── Cartog hook + 命令 ────────────────────────────────

	registerCartogHooks(pi, currentCwd);
	registerCartogCommands(pi);
}
