/**
 * 环境变量注入 + Session ID + 状态管理
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { updateSessionStatus, updateSessionSizeStatus, updateMemoryStatus } from "./lib/status";

export default function (pi: ExtensionAPI) {
	// ── Session/turn 状态更新 ─────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		updateSessionStatus(ctx);
	});

	pi.on("turn_start", async (_event, ctx) => {
		updateSessionStatus(ctx);
		updateSessionSizeStatus(ctx);
		updateMemoryStatus(ctx);
	});
}
