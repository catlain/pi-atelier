/**
 * 环境变量注入 + Session ID + 状态管理
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { updateSessionStatus, updateSessionSizeStatus, updateMemoryStatus } from "./lib/status";

// ── GLM 环境变量注入 ───────────────────────────────────
// 模块顶层立即执行，确保 MCP 初始化前 GLM_API_KEY 已就绪

if (!process.env.GLM_API_KEY) {
	try {
		const raw = readFileSync(resolve(homedir(), ".pi/agent/models.json"), "utf-8");
		const key = JSON.parse(raw)?.providers?.glm?.apiKey;
		if (key) process.env.GLM_API_KEY = key;
	} catch (e: any) {
		if (e.code !== "ENOENT") console.warn("env-and-status: models.json:", e.message);
	}
}

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
